"""HW9 image/geometry infrastructure, not ordering, tour or cover solvers.

Dependencies: numpy, matplotlib, Pillow. Image row indices are zero-based;
point IDs are one-based. Disk costs are full areas, including overlapping parts.
"""

import math
import textwrap

from HW9_helpers import tour_caption

import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.colors import hsv_to_rgb
from matplotlib.patches import Circle
import numpy as np
from PIL import Image


def load_rgb(filename):
    """Load without resizing: resizing shuffled rows would mix their contents."""
    with Image.open(filename) as image:
        return np.array(image.convert("RGB"))


def save_rgb(image, filename):
    array = np.asarray(image)
    if array.dtype != np.uint8 or array.ndim != 3 or array.shape[2] != 3:
        raise ValueError("Expected an H x W x 3 uint8 RGB image")
    Image.fromarray(array).save(filename)


def row_permutation(order, height):
    array = np.asarray(order)
    if (array.shape != (height,) or array.dtype.kind not in "iu"
            or not np.array_equal(np.sort(array), np.arange(height))):
        raise ValueError("Row order must contain each index 0..H-1 exactly once")
    return array.astype(np.int64)


def shuffle_rows(image, seed=20261024):
    """Return shuffled image and p: shuffled[j] = original[p[j]]."""
    image = np.asarray(image)
    permutation = np.random.default_rng(seed).permutation(len(image))
    return image[permutation].copy(), permutation


def reconstruct_rows(shuffled, order):
    """Assemble your proposed order; this function does not discover it."""
    return np.asarray(shuffled)[row_permutation(order, len(shuffled))].copy()


def row_distance_matrix(image):
    """Sum of absolute RGB differences; signed arithmetic, no uint8 wraparound."""
    image = np.asarray(image)
    if image.dtype != np.uint8 or image.ndim != 3 or image.shape[2] != 3:
        raise ValueError("Expected an H x W x 3 uint8 RGB image")
    rows = image.astype(np.int16).reshape(len(image), -1)
    distances = np.empty((len(rows), len(rows)), dtype=np.int64)
    # One source row at a time avoids an H x H x W x 3 temporary array.
    for i, row in enumerate(rows):
        distances[i] = np.abs(rows - row).sum(axis=1, dtype=np.int64)
    return distances


def row_path_cost(distances, order):
    distances = np.asarray(distances)
    order = row_permutation(order, len(distances))
    if distances.shape != (len(order), len(order)):
        raise ValueError("Expected a square distance matrix")
    return float(distances[order[:-1], order[1:]].sum())


def recovered_adjacencies(order, shuffle_permutation):
    """Testing only: fraction of original row neighbours recovered, unoriented."""
    height = len(shuffle_permutation)
    if height < 2:
        raise ValueError("Need at least two rows")
    p = row_permutation(shuffle_permutation, height)
    original_ids = p[row_permutation(order, height)]
    return float(np.count_nonzero(np.abs(np.diff(original_ids)) == 1) / (height - 1))


def show_rows(images, titles):
    if len(images) != len(titles) or not images:
        raise ValueError("Provide one title per image")
    fig, axes = plt.subplots(1, len(images), figsize=(5 * len(images), 4), squeeze=False,
                             layout="constrained")
    for ax, image, title in zip(axes[0], images, titles):
        ax.imshow(image)
        ax.set_title(title)
        ax.set_axis_off()
    return fig


def point_array(points):
    points = np.asarray(points, dtype=np.float64)
    if points.ndim != 2 or points.shape[1] != 2 or not np.isfinite(points).all():
        raise ValueError("Expected finite N x 2 coordinates")
    return points


def squared_distances(points):
    """All-pairs squared distances; 2000 x 2000 float64 entries use 32 MB."""
    xy = point_array(points)
    return ((xy[:, None, 0] - xy[None, :, 0]) ** 2
            + (xy[:, None, 1] - xy[None, :, 1]) ** 2)


def disk_from_radius(points, centre_id, radius_squared):
    """Build geometric membership for a radius YOU chose; not a k-NN solver."""
    xy = point_array(points)
    if type(centre_id) is not int or not 1 <= centre_id <= len(xy):
        raise ValueError("Centre ID must be an integer in 1..N")
    if not math.isfinite(radius_squared) or radius_squared <= 0:
        raise ValueError("Radius squared must be finite and positive")
    d2 = ((xy - xy[centre_id - 1]) ** 2).sum(axis=1)
    return {"centre_id": centre_id, "radius_squared": float(radius_squared),
            "members": (np.flatnonzero(d2 <= radius_squared) + 1).tolist(),
            "area": math.pi * radius_squared}


def check_cover(points, selected, min_members=10):
    """Independently recompute membership and cost; reject false coverage claims."""
    n = len(points)
    owner = np.full(n, -1, dtype=int)
    checked, seen = [], set()
    for index, disk in enumerate(selected):
        actual = disk_from_radius(points, disk["centre_id"], disk["radius_squared"])
        key = (actual["centre_id"], actual["radius_squared"])
        if key in seen:
            raise ValueError("Repeated selected disk")
        seen.add(key)
        if len(actual["members"]) < min_members:
            raise ValueError("Disk has fewer than the required number of members")
        if "members" in disk and sorted(disk["members"]) != actual["members"]:
            raise ValueError("Claimed members differ from geometric disk membership")
        ids = np.asarray(actual["members"]) - 1
        owner[ids[owner[ids] < 0]] = index
        checked.append(actual)
    missing = (np.flatnonzero(owner < 0) + 1).tolist()
    return {"valid": not missing, "uncovered": missing, "selected_count": len(checked),
            "total_area": math.fsum(d["area"] for d in checked),
            "owner": owner, "disks": checked}


def draw_geometry(points, edges=(), tour=None, ax=None, title="", labels=False,
                  *, name=None, timestamp=None):
    """Small-scale labelled examples or your own graph/tree/closed-tour output."""
    xy = point_array(points)
    if ax is None:
        _, ax = plt.subplots(figsize=(6, 6), layout="constrained")
    segments = []
    for a, b in edges:
        if not 1 <= a <= len(xy) or not 1 <= b <= len(xy):
            raise ValueError("Invalid edge ID")
        segments.append(xy[[a - 1, b - 1]])
    ax.add_collection(LineCollection(segments, colors="#64748b", linewidths=1.3))
    if tour is not None:
        order = row_permutation(np.asarray(tour) - 1, len(xy))
        caption = tour_caption(xy, (order + 1).tolist(), name, timestamp)
        line = xy[np.r_[order, order[0]]]
        ax.plot(line[:, 0], line[:, 1], color="#b83b43", linewidth=1.2)
    ax.scatter(xy[:, 0], xy[:, 1], s=18, color="#176c61", zorder=3)
    if labels:
        for vertex, (x, y) in enumerate(xy, 1):
            ax.annotate(str(vertex), (x, y), xytext=(5, 5), textcoords="offset points")
    if tour is not None:
        lines = [textwrap.fill(part, width=40) for part in caption.splitlines()]
        ax.set_title("\n".join(([title] if title else []) + lines), fontsize=9, parse_math=False)
    else:
        ax.set_title(title)
    ax.set_xlabel("x")
    ax.set_ylabel("y (image coordinates)")
    ax.set_aspect("equal")
    ax.margins(0.12)
    if not ax.yaxis_inverted():
        ax.invert_yaxis()
    return ax


def draw_cover(points, selected, ax=None, title="", min_members=10):
    """Colours indicate the FIRST selected covering disk, not exclusive membership."""
    result = check_cover(points, selected, min_members=min_members)
    xy = point_array(points)
    if ax is None:
        _, ax = plt.subplots(figsize=(7, 7), layout="constrained")
    colours = [plt.get_cmap("tab10")(i) for i in range(len(selected))] if len(selected) <= 10 else [
        (*hsv_to_rgb((i / len(selected), 0.75, 0.65)), 1.0) for i in range(len(selected))]
    for i, disk in enumerate(result["disks"]):
        centre = xy[disk["centre_id"] - 1]
        colour = colours[i]
        ax.add_patch(Circle(centre, math.sqrt(disk["radius_squared"]),
                            facecolor=(*colour[:3], 0.08), edgecolor=colour, linewidth=1.2))
        ax.scatter(*centre, marker="x", color=colour, s=40)
    for owner in sorted(set(result["owner"])):
        group = xy[result["owner"] == owner]
        ax.scatter(group[:, 0], group[:, 1], s=18,
                   color="#202020" if owner < 0 else colours[int(owner)],
                   marker="x" if owner < 0 else "o")
    ax.autoscale_view()
    ax.set_aspect("equal")
    ax.set_xlabel("x")
    ax.set_ylabel("y (image coordinates)")
    ax.set_title(title or f"{len(selected)} disks; area {result['total_area']:.1f}")
    if not ax.yaxis_inverted():
        ax.invert_yaxis()
    return ax
