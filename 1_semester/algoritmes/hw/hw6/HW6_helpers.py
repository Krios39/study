"""Algorithmics 2026 HW6: prepared graphs and plotting, without search solvers.

Use HW5_words.txt from the HW5 word archive. Drawing and PNG export need
matplotlib; loading words and constructing graphs use the standard library.
Run this file to export JSON data and two colour PNG maps with Q1 endpoints.
Use --show to open the figures too, or --json-only for a standard-library export.
"""

from collections import defaultdict
from itertools import combinations
from pathlib import Path


QUERIES = (
    ((30, 5), (30, 84)),
    ((5, 5), (54, 84)),
    ((54, 5), (5, 84)),
)


def load_words(path="HW5_words.txt"):
    """Return sorted, distinct five-letter ASCII lowercase words."""
    words = Path(path).read_text(encoding="ascii").splitlines()
    return sorted({w for w in words if len(w) == 5 and all("a" <= c <= "z" for c in w)})


def word_graph(words):
    """Undirected adjacency lists; an edge changes exactly one position."""
    words = sorted(set(words))
    if any(len(w) != 5 or not all("a" <= c <= "z" for c in w) for w in words):
        raise ValueError("Expected five-letter lowercase ASCII words")
    buckets = defaultdict(list)
    for word in words:
        for i in range(5):
            buckets[word[:i] + "*" + word[i + 1:]].append(word)
    graph = {word: [] for word in words}
    for bucket in buckets.values():
        for u, v in combinations(bucket, 2):
            graph[u].append(v)
            graph[v].append(u)
    return {word: sorted(adj) for word, adj in graph.items()}


def make_terrain(case="A"):
    """Original 60-by-90 grid: 0 blocked, 1 ordinary, 2 slow, 4 very slow."""
    if case not in ("A", "B"):
        raise ValueError("Use case A or B")
    grid = [[1 for _ in range(90)] for _ in range(60)]
    for r in range(12, 48):
        for c in range(36, 54):
            grid[r][c] = 4
    for r in range(35, 50):
        for c in range(8, 28):
            grid[r][c] = 2
    for r in range(7, 22):
        for c in range(65, 82):
            grid[r][c] = 2
    if case == "B":
        for r in range(60):
            if not 46 <= r <= 50:
                grid[r][29] = 0
            if not 9 <= r <= 13:
                grid[r][59] = 0
    return grid


def neighbours(grid, node):
    """Yield ((row, col), cost) in row/column order; no diagonal edges."""
    r, c = node
    rows, cols = len(grid), len(grid[0])
    if not (0 <= r < rows and 0 <= c < cols) or grid[r][c] == 0:
        raise ValueError("Node is outside the traversable grid")
    for rr, cc in ((r - 1, c), (r, c - 1), (r, c + 1), (r + 1, c)):
        if 0 <= rr < rows and 0 <= cc < cols and grid[rr][cc] != 0:
            yield (rr, cc), max(grid[r][c], grid[rr][cc])


def check_path(grid, path, source, target):
    """Check a returned path and sum its weight; does not check optimality."""
    if not path or path[0] != source or path[-1] != target:
        raise ValueError("Wrong or missing path endpoints")
    if len(set(path)) != len(path):
        raise ValueError("Path repeats a vertex")
    for r, c in path:
        if not (0 <= r < len(grid) and 0 <= c < len(grid[0])) or grid[r][c] == 0:
            raise ValueError("Path contains a blocked or out-of-grid vertex")
    total = 0
    for u, v in zip(path, path[1:]):
        choices = dict(neighbours(grid, u))
        if v not in choices:
            raise ValueError("Path uses a nonexistent edge")
        total += choices[v]
    return total


def draw_terrain(grid, path=(), settled=(), source=None, target=None, title="", ax=None,
                 comparison_path=()):
    """Overlay a search and optionally a dashed BFS path; return the axes."""
    import matplotlib.pyplot as plt
    from matplotlib.colors import BoundaryNorm, ListedColormap
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch

    if ax is None:
        _, ax = plt.subplots(figsize=(9, 6), constrained_layout=True)
    cmap = ListedColormap(["#333333", "#f3f5f6", "#99cbaa", "#619fcb"])
    norm = BoundaryNorm([-0.5, 0.5, 1.5, 3, 4.5], cmap.N)
    ax.imshow(grid, cmap=cmap, norm=norm, origin="upper", interpolation="nearest")
    if settled:
        rr, cc = zip(*settled)
        ax.scatter(cc, rr, s=3, color="#c35694", alpha=0.45, linewidths=0)
    if path:
        rr, cc = zip(*path)
        ax.plot(cc, rr, color="#a52525", linewidth=2)
    if comparison_path:
        rr, cc = zip(*comparison_path)
        ax.plot(cc, rr, color="#163f77", linewidth=1.5, linestyle="--")
    for node, label, marker in ((source, "S", "o"), (target, "T", "s")):
        if node is not None:
            r, c = node
            ax.scatter([c], [r], s=55, marker=marker, facecolor="white", edgecolor="black", zorder=5)
            ax.annotate(label, (c, r), xytext=(6, -10), textcoords="offset points", weight="bold")
    legend = [Patch(facecolor=color, label=label) for color, label in
              zip(cmap.colors, ("Blocked", "Cost 1", "Cost 2", "Cost 4"))]
    if path:
        legend.append(Line2D([], [], color="#a52525", label="Path"))
    if settled:
        legend.append(Line2D([], [], color="#c35694", marker=".", linestyle="none", label="Settled"))
    if comparison_path:
        legend.append(Line2D([], [], color="#163f77", linestyle="--", label="BFS path"))
    ax.legend(handles=legend, loc="upper center", bbox_to_anchor=(0.5, -0.12), ncol=3, fontsize=8)
    ax.set(title=title, xlabel="column", ylabel="row")
    return ax


def command_help(output, missing_matplotlib=False):
    """Copyable shell commands, keeping the caller's script and output paths."""
    import shlex
    import sys

    base = ["python3", sys.argv[0]]
    export = base + (["--output", str(output)] if output != Path("HW6_terrain.json") else [])
    lines = [
        "Useful commands (run in this same folder):",
        f"  {shlex.join(export)}  # save JSON and both PNGs",
        f"  {shlex.join(export + ['--show'])}  # also open the figures",
        f"  {shlex.join(export + ['--json-only'])}  # data only; no matplotlib needed",
        f"  {shlex.join(base + ['--help'])}  # all options",
    ]
    if missing_matplotlib:
        lines.extend([
            "",
            "Install matplotlib, then save and show the maps:",
            "  python3 -m pip install matplotlib",
            f"  {shlex.join(export + ['--show'])}",
            "",
            "If installation is blocked (e.g. externally-managed-environment),",
            "use a local virtual environment instead (macOS/Linux):",
            "  python3 -m venv .venv-hw6",
            "  source .venv-hw6/bin/activate",
            "  python3 -m pip install matplotlib",
            f"  {shlex.join(export + ['--show'])}",
            "In a new terminal, activate it again before running the helper:",
            "  source .venv-hw6/bin/activate",
        ])
    return "\n".join(lines)


def main():
    import argparse
    import json

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="HW6_terrain.json",
                        help="JSON path; PNGs are saved beside it as <stem>_A.png and <stem>_B.png")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--show", action="store_true", help="also open the terrain figures")
    mode.add_argument("--json-only", action="store_true",
                      help="export just JSON; matplotlib is not needed")
    args = parser.parse_args()
    output = Path(args.output)
    data = {"maps": {case: make_terrain(case) for case in ("A", "B")}, "queries": QUERIES}
    output.write_text(json.dumps(data, indent=2) + "\n", encoding="ascii")
    print(f"Wrote {output}")
    if args.json_only:
        print(command_help(output))
        return

    try:
        import matplotlib
    except ModuleNotFoundError as error:
        if error.name != "matplotlib":
            raise
        parser.exit(1, "JSON was exported, but PNG drawing needs matplotlib.\n\n"
                    + command_help(output, missing_matplotlib=True) + "\n")
    if not args.show:
        matplotlib.use("Agg")  # Save images even without a display (e.g. on a server).
    import matplotlib.pyplot as plt

    source, target = QUERIES[0]
    descriptions = {"A": "terrain patches, no walls", "B": "terrain patches and walls"}
    for case, grid in data["maps"].items():
        ax = draw_terrain(grid, source=source, target=target,
                          title=f"Map {case}: {descriptions[case]}\n"
                                f"Q1: S {source} -> T {target} (row, column)")
        picture = output.with_name(f"{output.stem}_{case}.png")
        ax.figure.savefig(picture, dpi=150)
        print(f"Wrote {picture}")
        if not args.show:
            plt.close(ax.figure)
    print("PNGs show input terrain and Q1 endpoints, not search solutions.")
    print(command_help(output))
    if args.show:
        plt.show()


if __name__ == "__main__":
    main()
