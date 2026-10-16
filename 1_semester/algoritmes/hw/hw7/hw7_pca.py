import hashlib
import json

import matplotlib
matplotlib.use("Agg")


def notebook_helpers(path="HW7_Image_Explorer_2026.ipynb"):
    cells = json.load(open(path, encoding="utf-8"))["cells"]
    namespace = {}
    for index in (1, 5):
        source = "".join(cells[index]["source"])
        source = "\n".join(line for line in source.splitlines() if not line.lstrip().startswith("%"))
        exec(source, namespace)
    return namespace


if __name__ == "__main__":
    nb = notebook_helpers()
    image_a = nb["load_rgb"](nb["IMAGE_A"])
    height, width = image_a.shape[:2]
    model = nb["fit_rgb_pca"](image_a)
    for i, fraction in enumerate(model["explained_fraction"], 1):
        print(f"PC{i}: {100 * fraction:.2f}% of A's variance")
    hashes = {name: hashlib.sha256(open(name, "rb").read()).hexdigest() for name in ("HW7_01.png", "HW7_02.png")}
    json.dump({"width": width, "height": height, "model": model, "sha256": hashes},
              open("HW7_pca_model.json", "w"), indent=2)
    print(f"A: {width} x {height}; wrote HW7_pca_model.json")
