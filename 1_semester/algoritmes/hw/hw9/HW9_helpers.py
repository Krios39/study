#!/usr/bin/env python3
"""HW9 fixed Euclidean point sets, drawings and tour validation; no TSP solver.

Validation, SVG and unlabelled PNGs use the standard library. Captioned tour
PNGs also use Pillow and Matplotlib's bundled font. Run with --help for usage.
Coordinates are integer pixel positions 0..1999, with y increasing downwards.
Vertex IDs are 1..N in file order. Route files contain each ID once, separated
by whitespace; do not repeat the first ID. The closing edge is added for scoring.
"""

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
from html import escape
import json
import math
from pathlib import Path
import random
import struct
import textwrap
import zlib


SEED = 20261018
SIZES = (100, 500, 2000)
SIDE = 2000
SEPARATION = 10
FRAME = 10
MARGIN = 20
OFFSET = FRAME + MARGIN
CANVAS = SIDE + 2 * OFFSET
RECORD_EPSILON = 0.000001
COMPETITION_SHA256 = "4dac0eaf01cb15d06128982530d228972a37fe7aefe7d8a1c4b6d1b1d420b1de"


def generate_points(count=2000, seed=SEED):
    """Seeded rejection sampling with a 10-pixel exclusion grid, not a lattice."""
    if not 1 <= count <= 2000:
        raise ValueError("This generator supports 1..2000 points")
    rng = random.Random(seed)
    points, cells = [], defaultdict(list)
    for _ in range(1000000):
        x, y = rng.randrange(SIDE), rng.randrange(SIDE)
        gx, gy = x // SEPARATION, y // SEPARATION
        nearby = (q for a in range(gx - 1, gx + 2)
                  for b in range(gy - 1, gy + 2) for q in cells[a, b])
        if any((x - u) ** 2 + (y - v) ** 2 < SEPARATION ** 2 for u, v in nearby):
            continue
        points.append((x, y))
        cells[gx, gy].append((x, y))
        if len(points) == count:
            return points
    raise RuntimeError("Could not generate requested points")


def check_points(points):
    """Independently check all pairs, bounds and integer coordinates."""
    if len(points) < 2:
        raise ValueError("Need at least two points")
    if any(len(p) != 2 or any(type(v) is not int or not 0 <= v < SIDE for v in p)
           for p in points):
        raise ValueError("Coordinates must be integers in 0..1999")
    minimum_squared = min((x - u) ** 2 + (y - v) ** 2
                          for i, (x, y) in enumerate(points)
                          for u, v in points[i + 1:])
    if minimum_squared < SEPARATION ** 2:
        raise ValueError("Two points are less than 10 pixels apart")
    return math.sqrt(minimum_squared)


def load_points(filename):
    """Read '# id x y' text; return [(x,y), ...], accessed by ID minus one."""
    points = []
    for line in Path(filename).read_text(encoding="ascii").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        fields = line.split()
        if len(fields) != 3:
            raise ValueError("Expected three columns: id x y")
        vertex, x, y = map(int, fields)
        if vertex != len(points) + 1:
            raise ValueError("Vertex IDs must be consecutive, starting at 1")
        if not (0 <= x < SIDE and 0 <= y < SIDE):
            raise ValueError("Point outside 0..1999")
        points.append((x, y))
    if len(points) < 3 or len(set(points)) != len(points):
        raise ValueError("Need at least three distinct points")
    return points


def load_tour(filename):
    """Read integer vertex IDs separated by spaces or newlines, without a header."""
    return [int(value) for value in Path(filename).read_text(encoding="ascii").split()]


def validate_tour(points, tour):
    """Return closed, unrounded Euclidean length; reject non-permutations."""
    n = len(points)
    if (n < 3 or len(tour) != n or any(type(v) is not int for v in tour)
            or set(tour) != set(range(1, n + 1))):
        raise ValueError("Tour must contain every ID 1..N exactly once (no repeated start)")
    return math.fsum(math.hypot(points[a - 1][0] - points[b - 1][0],
                               points[a - 1][1] - points[b - 1][1])
                     for a, b in zip(tour, tour[1:] + tour[:1]))


def canonical_tour(tour):
    """Same representation for a cycle's rotations and reversed direction."""
    index = tour.index(1)
    forward = tour[index:] + tour[:index]
    backward = forward[:1] + forward[:0:-1]
    return min(forward, backward)


def tour_caption(points, tour, name, timestamp=None):
    """Recompute the closed-tour score; timestamp is the drawing time in UTC."""
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Provide the participant's name for a tour drawing (--name on the CLI)")
    name = " ".join(name.split())
    if len(name) > 200:
        raise ValueError("Participant name must be at most 200 characters")
    length = validate_tour(points, tour)
    when = datetime.now(timezone.utc) if timestamp is None else timestamp
    if not isinstance(when, datetime) or when.tzinfo is None or when.utcoffset() is None:
        raise ValueError("Timestamp must be a timezone-aware datetime")
    return (f"{name}, TSP-length: {length:.3f}\n"
            f"{when.astimezone(timezone.utc):%Y-%m-%d %H:%M:%S} UTC")


def caption_lines(caption):
    """Wrap the name/score independently of the date, outside the data field."""
    return [line for part in caption.splitlines() for line in textwrap.wrap(part, width=56)]


def drawing_edges(points, edges=(), tour=None):
    """Yield (ID, ID, colour); edges may be an MST or another student's graph."""
    n = len(points)
    for a, b in edges:
        if type(a) is not int or type(b) is not int or not (1 <= a <= n and 1 <= b <= n) or a == b:
            raise ValueError("Edge endpoints must be distinct vertex IDs 1..N")
        yield a, b, "#6d8394"
    if tour is not None:
        validate_tour(points, tour)
        for a, b in zip(tour, tour[1:] + tour[:1]):
            yield a, b, "#c54e35"


def draw_svg(points, filename, edges=(), tour=None, stations=(), radius=0, selected=None,
             *, name=None, timestamp=None):
    """Keep the 2060x2060 field geometry; tour captions add a header above it."""
    segments = list(drawing_edges(points, edges, tour))
    caption = tour_caption(points, tour, name, timestamp) if tour is not None else None
    lines = caption_lines(caption) if caption else []
    header_height = 2 * MARGIN + 44 * len(lines) if lines else 0
    height = CANVAS + header_height
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{height}" viewBox="0 0 {CANVAS} {height}">',
             f'<title>{escape(Path(filename).stem)}: {len(points)} points</title>',
             '<rect width="100%" height="100%" fill="white"/>']
    if caption:
        parts.append(f'<desc>{escape(caption)}</desc>')
        for i, line in enumerate(lines):
            parts.append(f'<text x="{OFFSET}" y="{MARGIN + 32 + 44*i}" font-family="sans-serif" font-size="32" fill="#263746">{escape(line)}</text>')
        parts.append(f'<g transform="translate(0,{header_height})">')
    parts += [
             f'<rect x="{MARGIN}" y="{MARGIN}" width="{SIDE + 2 * FRAME}" height="{SIDE + 2 * FRAME}" fill="#263746"/>',
             f'<rect x="{OFFSET}" y="{OFFSET}" width="{SIDE}" height="{SIDE}" fill="white"/>',
             f'<defs><clipPath id="field"><rect x="{OFFSET}" y="{OFFSET}" width="{SIDE}" height="{SIDE}"/></clipPath></defs>',
             '<g clip-path="url(#field)">']
    selected = set(selected or ())
    for station in stations:
        x, y = station["x"] + OFFSET, station["y"] + OFFSET
        active = station["id"] in selected
        colour = "#b24926" if active else "#83958e"
        parts.append(f'<circle cx="{x}" cy="{y}" r="{radius}" fill="{colour if active else "none"}" fill-opacity="0.07" stroke="{colour}" stroke-width="2"/>')
    for a, b, colour in segments:
        x, y = points[a - 1]
        u, v = points[b - 1]
        parts.append(f'<line x1="{x + OFFSET + 0.5}" y1="{y + OFFSET + 0.5}" x2="{u + OFFSET + 0.5}" y2="{v + OFFSET + 0.5}" stroke="{colour}" stroke-width="1.5"/>')
    for vertex, (x, y) in enumerate(points, 1):
        parts.append(f'<circle cx="{x + OFFSET + 0.5}" cy="{y + OFFSET + 0.5}" r="3" fill="#173e60"><title>{vertex}: ({x}, {y})</title></circle>')
    for station in stations:
        x, y = station["x"] + OFFSET, station["y"] + OFFSET
        label = escape(f'{station["id"]}: cost {station["cost"]}')
        colour = "#b24926" if station["id"] in selected else "#50645b"
        parts.append(f'<rect x="{x - 6}" y="{y - 6}" width="12" height="12" fill="{colour}"/>')
        parts.append(f'<text x="{x + 12}" y="{y - 12}" font-family="sans-serif" font-size="22" fill="{colour}" stroke="white" stroke-width="4" paint-order="stroke">{label}</text>')
    parts.append('</g>')
    if caption:
        parts.append('</g>')
    parts.append('</svg>')
    Path(filename).write_text("\n".join(parts) + "\n", encoding="utf-8")


def draw_png(points, filename, edges=(), tour=None, *, name=None, timestamp=None):
    """Draw a PNG; tour captions use Pillow and a Matplotlib-bundled font."""
    segments = list(drawing_edges(points, edges, tour))
    caption = tour_caption(points, tour, name, timestamp) if tour is not None else None
    white = b"\xff\xff\xff"
    dark = bytes.fromhex("263746")
    pixels = bytearray(white * (CANVAS * CANVAS))
    for y in range(MARGIN, CANVAS - MARGIN):
        start = (y * CANVAS + MARGIN) * 3
        pixels[start:start + (SIDE + 2 * FRAME) * 3] = dark * (SIDE + 2 * FRAME)
    for y in range(OFFSET, OFFSET + SIDE):
        start = (y * CANVAS + OFFSET) * 3
        pixels[start:start + SIDE * 3] = white * SIDE

    def dot(x, y, colour):
        if 0 <= x < SIDE and 0 <= y < SIDE:
            start = ((y + OFFSET) * CANVAS + x + OFFSET) * 3
            pixels[start:start + 3] = colour

    for a, b, colour in segments:
        x, y = points[a - 1]
        u, v = points[b - 1]
        dx, dy = abs(u - x), -abs(v - y)
        sx, sy = (1 if x < u else -1), (1 if y < v else -1)
        error = dx + dy
        ink = bytes.fromhex(colour[1:])
        while True:
            dot(x, y, ink)
            if (x, y) == (u, v):
                break
            twice = 2 * error
            if twice >= dy:
                error += dy
                x += sx
            if twice <= dx:
                error += dx
                y += sy
    for x, y in points:
        for dx in range(-3, 4):
            for dy in range(-3, 4):
                if dx * dx + dy * dy <= 9:
                    dot(x + dx, y + dy, bytes.fromhex("173e60"))

    if caption:
        try:
            from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
            from matplotlib import get_data_path
        except ImportError as error:
            raise ValueError("Captioned PNG output needs Pillow and matplotlib; install them or use SVG") from error
        font = ImageFont.truetype(str(Path(get_data_path()) / "fonts/ttf/DejaVuSans.ttf"), 32)
        lines = caption_lines(caption)
        header_height = 2 * MARGIN + 44 * len(lines)
        labelled = Image.new("RGB", (CANVAS, CANVAS + header_height), "white")
        labelled.paste(Image.frombytes("RGB", (CANVAS, CANVAS), bytes(pixels)), (0, header_height))
        draw = ImageDraw.Draw(labelled)
        for i, line in enumerate(lines):
            draw.text((OFFSET, MARGIN + 44*i), line, font=font, fill="#263746")
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text("Description", caption)
        labelled.save(filename, pnginfo=metadata)
        return

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    rows = b"".join(b"\0" + pixels[y * CANVAS * 3:(y + 1) * CANVAS * 3] for y in range(CANVAS))
    header = struct.pack(">IIBBBBB", CANVAS, CANVAS, 8, 2, 0, 0, 0)
    Path(filename).write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
                               + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


def export_datasets(folder):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    points = generate_points()
    metadata = {"version": "HW9-2026-v2", "seed": SEED, "coordinate_range": [0, SIDE - 1],
                "minimum_separation": SEPARATION, "frame": FRAME, "outer_margin": MARGIN,
                "canvas_size": CANVAS, "nested_prefixes": True, "datasets": {}}
    for size in SIZES:
        subset = points[:size]
        minimum = check_points(subset)
        name = f"HW9_TSP_{size}"
        path = folder / f"{name}.txt"
        data = "# id x y\n" + "".join(f"{i} {x} {y}\n" for i, (x, y) in enumerate(subset, 1))
        path.write_bytes(data.encode("ascii"))
        draw_svg(subset, folder / f"{name}.svg")
        draw_png(subset, folder / f"{name}.png")
        metadata["datasets"][path.name] = {"count": size, "minimum_observed_distance": minimum,
                                            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        print(f"{path.name}: {size} points, minimum distance {minimum:.6f}; PNG and SVG written")
    (folder / "HW9_TSP_manifest.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="ascii")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    generate = commands.add_parser("generate", help="Rebuild the fixed three datasets and images")
    generate.add_argument("--output", default=".")
    validate = commands.add_parser("validate", help="Check a closed tour and independently score it")
    validate.add_argument("points")
    validate.add_argument("tour")
    validate.add_argument("--competition", action="store_true", help="Also enforce the official 2000-point input hash")
    plot = commands.add_parser("plot", help="Draw points, optional edges, and/or a tour")
    plot.add_argument("points")
    plot.add_argument("--tour", help="Whitespace-separated vertex IDs, each exactly once")
    plot.add_argument("--name", help="Participant name (required with --tour), e.g. 'Donald Duck'")
    plot.add_argument("--edges", help="Two integer vertex IDs per line; no header")
    plot.add_argument("--stations", help="HW9_cover.json: overlay the map station disks (SVG only)")
    plot.add_argument("--selected", type=int, nargs="*", default=[], help="Selected map station IDs, e.g. --selected 1 4 11")
    plot.add_argument("--output", required=True, help=".png or .svg output path")
    args = parser.parse_args()
    try:
        if args.command == "generate":
            export_datasets(args.output)
            return
        points = load_points(args.points)
        if args.command == "validate":
            input_hash = hashlib.sha256(Path(args.points).read_bytes()).hexdigest()
            if args.competition and (len(points) != 2000 or input_hash != COMPETITION_SHA256):
                raise ValueError("This is not the official HW9_TSP_2000.txt competition input")
            tour = load_tour(args.tour)
            length = validate_tour(points, tour)
            signature = " ".join(map(str, canonical_tour(tour))).encode("ascii")
            print(json.dumps({"valid": True, "vertices": len(points), "length": length,
                              "points_sha256": input_hash,
                              "official_competition_input": len(points) == 2000 and input_hash == COMPETITION_SHA256,
                              "cycle_sha256": hashlib.sha256(signature).hexdigest(),
                              "record_improvement_must_exceed": RECORD_EPSILON}, indent=2))
        else:
            tour = load_tour(args.tour) if args.tour else None
            if args.name is not None and tour is None:
                raise ValueError("--name requires --tour")
            edges = []
            if args.edges:
                for line in Path(args.edges).read_text(encoding="ascii").splitlines():
                    if line.strip():
                        a, b = map(int, line.split())
                        edges.append((a, b))
            suffix = Path(args.output).suffix.lower()
            if suffix not in (".svg", ".png"):
                raise ValueError("Output must end in .svg or .png")
            if args.stations:
                if suffix != ".svg":
                    raise ValueError("Coverage disks currently use SVG output")
                problem = json.loads(Path(args.stations).read_text(encoding="utf-8"))["map"]
                ids = {station["id"] for station in problem["stations"]}
                if not set(args.selected) <= ids or len(args.selected) != len(set(args.selected)):
                    raise ValueError("Selected station IDs must be distinct and present in the input")
                draw_svg(points, args.output, edges, tour, problem["stations"],
                         math.sqrt(problem["radius_squared"]), args.selected, name=args.name)
            elif args.selected:
                raise ValueError("--selected requires --stations")
            else:
                (draw_svg if suffix == ".svg" else draw_png)(points, args.output, edges, tour, name=args.name)
            print(f"Wrote {args.output}")
    except (OSError, ValueError) as error:
        parser.exit(2, f"Error: {error}\n")


if __name__ == "__main__":
    main()
