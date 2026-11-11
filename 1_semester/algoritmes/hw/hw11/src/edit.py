import numpy as np


def unit_sub(a, b):
    return 0 if a == b else 1


def swap_cost(swap, source, target, i, j):
    if swap is None or i < 2 or j < 2:
        return None
    if callable(swap):
        return swap(source[i - 2], source[i - 1], target[j - 2], target[j - 1])
    return swap if source[i - 2] == target[j - 1] and source[i - 1] == target[j - 2] else None


def edit_table(source, target, sub=unit_sub, swap=None, indel=1):
    d = np.zeros((len(source) + 1, len(target) + 1))
    d[0, :] = np.arange(len(target) + 1) * indel
    d[:, 0] = np.arange(len(source) + 1) * indel
    for i in range(1, len(source) + 1):
        for j in range(1, len(target) + 1):
            best = min(d[i - 1, j] + indel, d[i, j - 1] + indel, d[i - 1, j - 1] + sub(source[i - 1], target[j - 1]))
            cost = swap_cost(swap, source, target, i, j)
            if cost is not None:
                best = min(best, d[i - 2, j - 2] + cost)
            d[i, j] = best
    return d


def traceback(d, source, target, sub=unit_sub, swap=None, indel=1):
    i, j, steps = len(source), len(target), []
    while i or j:
        if i and j and np.isclose(d[i, j], d[i - 1, j - 1] + sub(source[i - 1], target[j - 1])):
            kind = "keep" if source[i - 1] == target[j - 1] else "substitute"
            steps.append((kind, i, j, d[i, j] - d[i - 1, j - 1]))
            i, j = i - 1, j - 1
        elif (swap_cost(swap, source, target, i, j) is not None
              and np.isclose(d[i, j], d[i - 2, j - 2] + swap_cost(swap, source, target, i, j))):
            steps.append(("swap", i, j, swap_cost(swap, source, target, i, j)))
            i, j = i - 2, j - 2
        elif i and np.isclose(d[i, j], d[i - 1, j] + indel):
            steps.append(("delete", i, j, indel))
            i -= 1
        else:
            steps.append(("insert", i, j, indel))
            j -= 1
    return steps[::-1]


def path_cells(steps):
    cells = [(0, 0)]
    for kind, i, j, _ in steps:
        cells.append((i, j))
    return cells


def replay(steps, source, target):
    lines = []
    for kind, i, j, cost in steps:
        if kind == "keep":
            continue
        word = target[:j] + source[i:]
        if kind == "substitute":
            what = f"substitute {source[i - 1]!r} -> {target[j - 1]!r}"
        elif kind == "delete":
            what = f"delete {source[i - 1]!r}"
        elif kind == "insert":
            what = f"insert {target[j - 1]!r}"
        else:
            what = f"swap {source[i - 2:i]!r} -> {target[j - 2:j]!r}"
        lines.append((what, cost, word))
    return lines
