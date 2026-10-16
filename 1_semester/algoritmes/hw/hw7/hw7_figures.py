import json
import sys

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

from hw7_pca import notebook_helpers

CELLS = [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2), (1, 2), (0, 2), (0, 1), (1, 1)]

nb = notebook_helpers()
image_a = nb["load_rgb"](nb["IMAGE_A"])
pixels_a = image_a.reshape(-1, 3)
height, width = image_a.shape[:2]


def save_jpg(fig, name):
    fig.savefig(name, dpi=110, pil_kwargs={"quality": 88})
    plt.close(fig)


def t1():
    res = json.load(open("HW7_T1_results.json"))
    for c in res["codes"]:
        x, y = c["pixel"]
        assert list(image_a[y, x]) == c["rgb"], c["code"]
    print("T1: Rust RGB values match the notebook loader")

    fig, ax = plt.subplots(figsize=(13, 8.9), constrained_layout=True)
    ax.imshow(image_a)
    for c in res["codes"]:
        x, y = c["pixel"]
        ax.scatter(x, y, s=90, facecolors="white", edgecolors="black", linewidths=1.5, zorder=3)
        ax.scatter(x, y, s=12, color="black", zorder=4)
        dx, ha = (10, "left") if x < width - 150 else (-10, "right")
        dy = -12 if y > 60 else 12
        ax.annotate(c["code"], (x, y), xytext=(dx, dy), textcoords="offset points", ha=ha, fontsize=10,
                    bbox={"facecolor": "white", "edgecolor": "black", "alpha": 0.9, "boxstyle": "round,pad=0.25"})
    ax.set(title="Image A: representative pixels of the twelve depth-7 codes", xlabel="pixel x", ylabel="pixel y")
    save_jpg(fig, "HW7_T1_codes.jpg")

    boxes = res["boxes"]
    cx, cy = res["centre"]
    colors = plt.cm.plasma(np.linspace(0, 0.85, len(boxes)))
    views = [("Whole image", (0, width), (height, 0)),
             ("Zoom 1: boxes 1, 12, 123", (150, 520), (360, 0)),
             ("Zoom 2: boxes 123, 1234, 12345", (280, 345), (40, 0)),
             ("Zoom 3: boxes 12345, 123456, 1234567", (334.5, 342), (26, 20.5))]
    fig, axes = plt.subplots(2, 2, figsize=(14, 10), constrained_layout=True)
    for ax, (title, xl, yl) in zip(axes.flat, views):
        ax.imshow(image_a, interpolation="nearest")
        for b, col in zip(boxes, colors):
            x0, y0, x1, y1 = b["rect"]
            ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, fill=False, edgecolor=col, linewidth=2.2))
            visible = x0 < xl[1] and x1 > xl[0] and y0 < yl[0] and y1 > yl[1]
            if visible and (x1 - x0) > (xl[1] - xl[0]) / 40 and (x1 - x0) < (xl[1] - xl[0]) * 3:
                lx = max(x0, xl[0])
                if b["prefix"] == "ROOT":
                    ax.annotate("ROOT", (lx, min(y1, yl[0])), xytext=(3, -3), textcoords="offset points", va="bottom", fontsize=9, zorder=8,
                                bbox={"facecolor": col, "edgecolor": "none", "alpha": 0.85, "pad": 1.5})
                else:
                    ly = max(y0, yl[1])
                    ax.annotate(b["prefix"], (lx, ly), xytext=(3, -3), textcoords="offset points", va="top", fontsize=9, zorder=8,
                                bbox={"facecolor": col, "edgecolor": "none", "alpha": 0.85, "pad": 1.5})
        ax.scatter([cx], [cy], marker="x", s=80, color="white", linewidths=3, zorder=5)
        ax.scatter([cx], [cy], marker="x", s=60, color="black", linewidths=1.5, zorder=6)
        if title.startswith("Zoom 3"):
            for gx in range(335, 343):
                ax.axvline(gx, color="white", linewidth=0.5, alpha=0.6)
            for gy in range(21, 27):
                ax.axhline(gy, color="white", linewidth=0.5, alpha=0.6)
        ax.set(xlim=xl, ylim=yl, title=title, xlabel="pixel x", ylabel="pixel y")
    fig.suptitle("Ancestor boxes of 1234567 (x marks its decoded centre; zoom 3 shows the pixel grid)")
    save_jpg(fig, "HW7_T1_boxes.jpg")


def encode_bins(pc, lo, hi, n):
    return np.clip(np.floor((pc - lo) / (hi - lo) * n).astype(np.int64), 0, n - 1)


def code_of(col, row, depth):
    digits = []
    for i in range(depth):
        p = 3 ** (depth - 1 - i)
        digits.append(str(CELLS.index((col // p % 3, row // p % 3)) + 1))
    return "".join(digits)


def t2():
    res = json.load(open("HW7_T2_results.json"))
    model = nb["fit_rgb_pca"](image_a)
    pca_a = nb["transform_rgb"](pixels_a, model)
    depth, n = res["depth"], 3 ** res["depth"]
    display_ids = np.sort(np.random.default_rng(nb["PLOT_SEED"]).choice(len(pixels_a), nb["PLOT_SAMPLE_SIZE"], replace=False))

    fig, axes = plt.subplots(1, 3, figsize=(18, 6.4), constrained_layout=True)
    for ax, view in zip(axes, res["views"]):
        a, b = view["pair"][0] - 1, view["pair"][1] - 1
        x0, y0, x1, y1 = view["root"]
        assert np.isclose(x0, pca_a[:, a].min()) and np.isclose(x1, pca_a[:, a].max())
        col = encode_bins(pca_a[:, a], x0, x1, n)
        row = n - 1 - encode_bins(pca_a[:, b], y0, y1, n)
        counts = np.bincount(row * n + col, minlength=n * n)
        assert counts.sum() == width * height == view["total"]
        order = sorted(np.nonzero(counts)[0], key=lambda c: (-counts[c], code_of(c % n, c // n, depth)))[:10]
        numpy_top = [(code_of(c % n, c // n, depth), int(counts[c])) for c in order]
        rust_top = [(t["code"], t["count"]) for t in view["top"]]
        assert numpy_top == rust_top, (numpy_top, rust_top)
        for t in view["top"]:
            bx0, by0, bx1, by1 = t["box"]
            p = pca_a[t["rep_id"]]
            assert bx0 <= p[a] <= bx1 and by0 <= p[b] <= by1, t["code"]
            assert list(pixels_a[t["rep_id"]]) == t["rep_rgb"]
        print(f"T2 PC{a+1}-PC{b+1}: numpy recount matches Rust top ten, counts sum to {counts.sum()}, representatives inside their cells")

        ax.scatter(pca_a[display_ids, a], pca_a[display_ids, b], c=pixels_a[display_ids] / 255, s=3, linewidths=0, rasterized=True)
        for rank, t in enumerate(view["top"], 1):
            bx0, by0, bx1, by1 = t["box"]
            ax.add_patch(Rectangle((bx0, by0), bx1 - bx0, by1 - by0, fill=False, edgecolor="black", linewidth=1.6, zorder=4))
            ax.add_patch(Rectangle((bx0, by0), bx1 - bx0, by1 - by0, fill=False, edgecolor="white", linewidth=0.6, zorder=5))
        ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, fill=False, edgecolor="grey", linestyle="--", linewidth=1))
        pad_x, pad_y = (x1 - x0) * 0.04, (y1 - y0) * 0.04
        ax.set(xlim=(x0 - pad_x, x1 + pad_x), ylim=(y0 - pad_y, y1 + pad_y), xlabel=f"PC{a+1}", ylabel=f"PC{b+1}",
               title=f"PC{a+1}-PC{b+1}: top ten depth-4 cells ({100 * view['top_total'] / view['total']:.1f}% of pixels)")
        ax.set_aspect("equal", adjustable="box")
    save_jpg(fig, "HW7_T2_pca.jpg")

    fig, axes = plt.subplots(3, 1, figsize=(13, 15), constrained_layout=True)
    for ax, view in zip(axes, res["views"]):
        a, b = view["pair"][0] - 1, view["pair"][1] - 1
        boxes = np.array([t["box"] for t in view["top"]])
        zx0, zy0 = boxes[:, 0].min(), boxes[:, 1].min()
        zx1, zy1 = boxes[:, 2].max(), boxes[:, 3].max()
        mx, my = (zx1 - zx0) * 0.12 + 0.01, (zy1 - zy0) * 0.6 + 0.01
        inside = ((pca_a[:, a] > zx0 - mx) & (pca_a[:, a] < zx1 + mx) & (pca_a[:, b] > zy0 - my) & (pca_a[:, b] < zy1 + my))
        local = np.nonzero(inside)[0]
        local = local[np.random.default_rng(nb["PLOT_SEED"]).choice(len(local), min(30_000, len(local)), replace=False)]
        ax.scatter(pca_a[local, a], pca_a[local, b], c=pixels_a[local] / 255, s=5, linewidths=0, rasterized=True)
        for rank, t in enumerate(view["top"], 1):
            bx0, by0, bx1, by1 = t["box"]
            ax.add_patch(Rectangle((bx0, by0), bx1 - bx0, by1 - by0, fill=False, edgecolor="black", linewidth=2, zorder=4))
            ax.add_patch(Rectangle((bx0, by0), bx1 - bx0, by1 - by0, fill=False, edgecolor="white", linewidth=0.7, zorder=5))
            ax.annotate(str(rank), ((bx0 + bx1) / 2, by1), xytext=(0, 3), textcoords="offset points", ha="center", va="bottom",
                        fontsize=10, fontweight="bold", zorder=6,
                        bbox={"facecolor": "white", "edgecolor": "black", "linewidth": 0.5, "alpha": 0.9, "pad": 1})
            ax.scatter(*t["rep_pc"], marker="*", s=110, color=np.array(t["rep_rgb"]) / 255, edgecolors="white", linewidths=1.2, zorder=7)
        ax.set(xlim=(zx0 - mx, zx1 + mx), ylim=(zy0 - my, zy1 + my), xlabel=f"PC{a+1}", ylabel=f"PC{b+1}",
               title=f"PC{a+1}-PC{b+1}: zoom on the top ten cells (number = rank, star = representative in its own colour; axes not to scale)")
    save_jpg(fig, "HW7_T2_pca_zoom.jpg")


if __name__ == "__main__":
    tasks = {"t1": t1, "t2": t2}
    for name in sys.argv[1:] or tasks:
        tasks[name]()
