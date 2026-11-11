import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

ROOT = Path(__file__).resolve().parent.parent


def load(notebook, cells, name):
    source = json.loads((ROOT / notebook).read_text(encoding="utf-8"))["cells"]
    namespace = {"__name__": name}
    for index in cells:
        exec("".join(source[index]["source"]), namespace)
    if "plt" in namespace:
        namespace["plt"].show = lambda *args, **kwargs: None
    return namespace


def word_helpers(cells=(2,)):
    return load("HW11_Word_Recovery_2026.ipynb", cells, "hw11_words")


def signal_helpers(cells=(1, 2, 6, 11)):
    return load("HW11_Signal_Alignment_2026.ipynb", cells, "hw11_signal")
