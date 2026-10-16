import json

import numpy as np

CELLS = [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2), (1, 2), (0, 2), (0, 1), (1, 1)]


def notebook_helpers(path="HW7_Image_Explorer_2026.ipynb"):
    cells = json.load(open(path, encoding="utf-8"))["cells"]
    namespace = {}
    for index in (1, 5):
        source = "".join(cells[index]["source"])
        source = "\n".join(line for line in source.splitlines() if not line.lstrip().startswith("%"))
        exec(source, namespace)
    return namespace


def decode(code, width, height):
    cx = ry = 0
    for ch in code:
        col, row = CELLS[int(ch) - 1]
        cx, ry = 3 * cx + col, 3 * ry + row
    n = 3 ** len(code)
    return width * cx / n, height * ry / n, width * (cx + 1) / n, height * (ry + 1) / n


def code_of(col, row, depth):
    return "".join(str(CELLS.index((col // 3 ** (depth - 1 - i) % 3, row // 3 ** (depth - 1 - i) % 3)) + 1) for i in range(depth))


def bins(values, lo, hi, n):
    return np.clip(np.floor((values - lo) / (hi - lo) * n).astype(np.int64), 0, n - 1)


nb = notebook_helpers()
image_a = nb["load_rgb"](nb["IMAGE_A"])
pixels_a = image_a.reshape(-1, 3)
height, width = image_a.shape[:2]

rust = json.load(open("HW7_pca_model.json"))["model"]
model = nb["fit_rgb_pca"](image_a)
for key in ("mean", "axes_columns", "variance"):
    assert np.allclose(rust[key], model[key], atol=1e-10), key
print("PCA: Rust model equals the notebook's fit_rgb_pca (mean, axes incl. signs, variance)")

t1 = json.load(open("HW7_T1_results.json"))
for c in t1["codes"]:
    x0, y0, x1, y1 = decode(c["code"], width, height)
    assert np.allclose([x0, y0, x1, y1], c["rect"])
    x, y = int((x0 + x1) / 2), int((y0 + y1) / 2)
    assert [x, y] == c["pixel"] and list(image_a[y, x]) == c["rgb"], c["code"]
print("T1: independent decoding gives the same rectangles, pixels and RGB values")

t2 = json.load(open("HW7_T2_results.json"))
pca_a = nb["transform_rgb"](pixels_a, model)
depth = t2["depth"]
n = 3 ** depth
for view in t2["views"]:
    a, b = view["pair"][0] - 1, view["pair"][1] - 1
    x0, y0, x1, y1 = view["root"]
    assert np.isclose(x0, pca_a[:, a].min()) and np.isclose(x1, pca_a[:, a].max())
    assert np.isclose(y0, pca_a[:, b].min()) and np.isclose(y1, pca_a[:, b].max())
    col = bins(pca_a[:, a], x0, x1, n)
    row = n - 1 - bins(pca_a[:, b], y0, y1, n)
    counts = np.bincount(row * n + col, minlength=n * n)
    assert counts.sum() == width * height == view["total"]
    order = sorted(np.nonzero(counts)[0], key=lambda c: (-counts[c], code_of(c % n, c // n, depth)))[:10]
    assert [(code_of(c % n, c // n, depth), int(counts[c])) for c in order] == [(t["code"], t["count"]) for t in view["top"]]
    for t in view["top"]:
        bx0, by0, bx1, by1 = t["box"]
        p = pca_a[t["rep_id"]]
        assert bx0 <= p[a] <= bx1 and by0 <= p[b] <= by1, t["code"]
        assert list(pixels_a[t["rep_id"]]) == t["rep_rgb"]
    print(f"T2 PC{a+1}-PC{b+1}: NumPy recount with the notebook PCA matches the Rust top ten; "
          f"counts sum to {counts.sum()}; representatives inside their cells")
