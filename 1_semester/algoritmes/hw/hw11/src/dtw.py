import numpy as np


def dtw(query, candidate, band=None):
    n, m = len(query), len(candidate)
    d = np.full((n + 1, m + 1), np.inf)
    d[0, 0] = 0
    cells = 0
    for i in range(1, n + 1):
        low, high = (1, m) if band is None else (max(1, i - band), min(m, i + band))
        for j in range(low, high + 1):
            cost = (query[i - 1] - candidate[j - 1]) ** 2
            d[i, j] = cost + min(d[i - 1, j], d[i, j - 1], d[i - 1, j - 1])
            cells += 1
    return d, cells


def dtw_path(d):
    i, j = d.shape[0] - 1, d.shape[1] - 1
    path = [(i - 1, j - 1)]
    while (i, j) != (1, 1):
        moves = [(d[i - 1, j - 1], i - 1, j - 1), (d[i - 1, j], i - 1, j), (d[i, j - 1], i, j - 1)]
        _, i, j = min(moves, key=lambda move: move[0])
        path.append((i - 1, j - 1))
    return path[::-1]


def pointwise(query, candidate):
    return float(np.sum((query - candidate) ** 2))


def winner(scores):
    return int(np.argmin(scores))


def rank(scores, row):
    order = sorted(range(len(scores)), key=lambda y: (scores[y], y))
    return order.index(row) + 1
