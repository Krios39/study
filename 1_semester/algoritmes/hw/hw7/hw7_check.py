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

import hashlib

t3 = json.load(open("HW7_T3_results.json"))
a, b = t3["pair"][0] - 1, t3["pair"][1] - 1
plane = pca_a[:, [a, b]]
for palette in t3["palettes"]:
    reps = palette["reps"]
    ids = [r["id"] for r in reps]
    assert ids == sorted(ids)
    sites = plane[ids]
    labels = np.empty(len(plane), dtype=np.uint8)
    for start in range(0, len(plane), 200_000):
        block = plane[start:start + 200_000]
        d = ((block[:, None, :] - sites[None, :, :]) ** 2).sum(axis=2)
        labels[start:start + 200_000] = np.argmax(d <= d.min(axis=1, keepdims=True) + palette["tie_eps"], axis=1)
    counts = np.bincount(labels, minlength=len(reps))
    assert counts.sum() == width * height
    assert list(counts) == [r["count"] for r in reps], palette["name"]
    assert hashlib.sha256(labels.tobytes()).hexdigest() == palette["labels_sha256"], palette["name"]
    for k, i in enumerate(ids):
        assert labels[i] == min(j for j in range(len(ids)) if np.allclose(sites[j], sites[k]))
        assert list(pixels_a[i]) == reps[k]["rgb"]
    error = np.sqrt(((pixels_a.astype(float) - pixels_a[ids][labels].astype(float)) ** 2).sum(axis=1)).mean()
    assert np.isclose(error, palette["mean_rgb_error"]), palette["name"]
    print(f"T3 {palette['name']}: NumPy reassignment of all pixels gives identical labels (sha256), "
          f"counts sum to {counts.sum()}, representatives label themselves, mean RGB error {error:.2f}")

t4 = json.load(open("HW7_T4_results.json"))
ids = [r["id"] for r in t4["reps"]]
rep_rgb = pixels_a[ids].astype(np.float64) / 255
assert [list(map(int, c)) for c in pixels_a[ids]] == [r["rgb"] for r in t4["reps"]]
px = pixels_a.astype(np.float64) / 255
grey_px = (pixels_a[:, 0] == pixels_a[:, 1]) & (pixels_a[:, 1] == pixels_a[:, 2])
grey_rep = (pixels_a[ids, 0] == pixels_a[ids, 1]) & (pixels_a[ids, 1] == pixels_a[ids, 2])
assert grey_px.sum() == t4["grey_pixels"] and grey_rep.sum() == t4["grey_reps"]
eps = t4["tie_eps"]
labels_by = {}
for name in ("3d", "corr"):
    labels = np.empty(len(px), dtype=np.uint8)
    for s in range(0, len(px), 200_000):
        block, gp = px[s:s + 200_000], grey_px[s:s + 200_000]
        if name == "3d":
            d = ((block[:, None, :] - rep_rgb[None]) ** 2).sum(axis=2)
        else:
            a0 = block - block.mean(axis=1, keepdims=True)
            b0 = rep_rgb - rep_rgb.mean(axis=1, keepdims=True)
            with np.errstate(invalid="ignore", divide="ignore"):
                r = (a0 @ b0.T) / (np.linalg.norm(a0, axis=1)[:, None] * np.linalg.norm(b0, axis=1)[None, :])
            d = 1 - np.clip(r, -1, 1)
            d[gp[:, None] & grey_rep[None, :]] = 0.0
            d[gp[:, None] ^ grey_rep[None, :]] = 1.0
        labels[s:s + 200_000] = np.argmax(d <= d.min(axis=1, keepdims=True) + eps, axis=1)
    labels_by[name] = labels
    rust = next(r for r in t4["rules"] if r["name"] == name)
    assert list(np.bincount(labels, minlength=len(ids))) == rust["counts"], name
    assert hashlib.sha256(labels.tobytes()).hexdigest() == rust["labels_sha256"], name
print(f"T4: NumPy reassignment by 3D RGB Euclidean and by correlation gives identical labels (sha256); "
      f"{t4['grey_pixels']} grey pixels, all labelled {np.bincount(labels_by['corr'][grey_px], minlength=len(ids)).tolist()}")
a10, a110 = np.array([10, 20, 30.]), np.array([110, 120, 130.])
print("T4: r((10,20,30),(110,120,130)) =", np.corrcoef(a10, a110)[0, 1])

t5 = json.load(open("HW7_T5_results.json"))


def side_counts(s, t):
    return [int((s < t).sum()), int((s == t).sum()), int((s > t).sum())]


def check_part(name, s, res):
    t0 = s[res["anchor"]]
    assert np.isclose(t0, res["t0"], atol=1e-12)
    assert side_counts(s, t0) == res["before"], (name, side_counts(s, t0), res["before"])
    med = np.median(s)
    assert np.isclose(med, res["median"], atol=1e-12)
    assert side_counts(s, med) == res["after"], name
    order = np.lexsort((np.arange(len(s)), s))
    cut = len(s) // 2
    assert cut == res["group_low"] and len(s) - cut == res["group_high"]
    assert order[cut - 1] == res["last_low_id"] and order[cut] == res["first_high_id"], name
    print(f"T5 {name}: NumPy recomputation gives the same t0, median, side counts {res['before']} -> {res['after']} and balanced split")


wa = np.array(t5["a"]["w"])
assert np.isclose(np.linalg.norm(wa), 1)
check_part("A (2D)", pca_a[:, :2] @ wa, t5["a"])
wb = np.array(t5["b"]["w"])
assert np.isclose(np.linalg.norm(wb), 1)
proj_b = np.empty(nb["strip_count"](image_a))
for strip_ids, vectors in nb["iter_strips"](image_a, batch_size=200_000):
    proj_b[strip_ids] = vectors @ wb
assert len(proj_b) == t5["b"]["count"]
check_part("B (15D)", proj_b, t5["b"])
for key in ("low", "high"):
    e = t5["b"]["examples"][key]
    xs, ys = nb["strip_xy"](image_a, np.array([e["id"]]))
    assert (int(xs[0]), int(ys[0])) == (e["x"], e["y"])
    assert [list(map(int, image_a[e["y"], e["x"] + k])) for k in range(5)] == e["rgb"]
print("T5: the two example strips have the reported locations and colours")
