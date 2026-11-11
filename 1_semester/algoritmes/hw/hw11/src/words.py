from edit import edit_table, traceback, unit_sub
from nb import ROOT, word_helpers

UNIT = 5
SIMILAR = ("aä", "eë", "oö", "uü", "li")
GROUP = {c: g for g in SIMILAR for c in g}


def weighted_sub(a, b):
    if a == b:
        return 0
    x, y = a.lower(), b.lower()
    if x == y or GROUP.get(x, x) == GROUP.get(y, y) and x in GROUP:
        return 1
    return UNIT


def unit_cost(a, b):
    return UNIT * unit_sub(a, b)


def soft_swap(a1, a2, b1, b2):
    first, second = weighted_sub(a1, b2), weighted_sub(a2, b1)
    if first < UNIT and second < UNIT:
        return UNIT + first + second
    return None


MODELS = {"unit": (unit_cost, None), "weighted": (weighted_sub, None),
          "weighted+strict swap": (weighted_sub, UNIT), "weighted+swap": (weighted_sub, soft_swap)}


def distance(source, target, model):
    sub, swap = MODELS[model]
    return int(edit_table(source, target, sub, swap, UNIT)[-1, -1])


def edits(source, target, model):
    sub, swap = MODELS[model]
    d = edit_table(source, target, sub, swap, UNIT)
    return traceback(d, source, target, sub, swap, UNIT)


def search(query, dictionary, model):
    scores = {word: distance(query, word, model) for word in dictionary}
    best = min(scores.values())
    return {word for word, score in scores.items() if score == best}


def ranked(query, dictionary, model):
    return sorted((distance(query, word, model), word) for word in dictionary)


def load_levels():
    return {level: (ROOT / "words" / f"words.{level}.txt").read_text(encoding="utf-8").splitlines()
            for level in range(7)}


def evaluation():
    h = word_helpers(())
    levels = load_levels()
    h.update(levels=levels, originals=levels[0])
    import json
    cells = json.loads((ROOT / "HW11_Word_Recovery_2026.ipynb").read_text(encoding="utf-8"))["cells"]
    exec("".join(cells[10]["source"]), h)
    return h
