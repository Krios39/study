import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

NOTEBOOK = Path(__file__).resolve().parent.parent / "HW10_DE_Fitting_2026.ipynb"
HELPER_CELLS = (6, 8, 10, 17, 21, 24)


def helpers():
    cells = json.loads(NOTEBOOK.read_text(encoding="utf-8"))["cells"]
    namespace = {"__name__": "hw10_helpers"}
    for index in HELPER_CELLS:
        exec("".join(cells[index]["source"]), namespace)
    return namespace


IMAGE_NOTEBOOK = NOTEBOOK.parent / "HW10_Image_Evolution_2026.ipynb"
IMAGE_HELPER_CELLS = (8, 10, 12, 22)


def image_helpers():
    cells = json.loads(IMAGE_NOTEBOOK.read_text(encoding="utf-8"))["cells"]
    namespace = {"__name__": "hw10_image_helpers"}
    for index in IMAGE_HELPER_CELLS:
        exec("".join(cells[index]["source"]), namespace)
    return namespace
