import numpy as np

from edit import swap_cost, unit_sub


def best_match(query, segment, sub=unit_sub, swap=None, indel=1):
    m, n = len(query), len(segment)
    d = np.zeros((m + 1, n + 1))
    start = np.tile(np.arange(n + 1), (m + 1, 1))
    d[:, 0] = np.arange(m + 1) * indel
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            options = [(d[i - 1, j - 1] + sub(query[i - 1], segment[j - 1]), start[i - 1, j - 1]),
                       (d[i, j - 1] + indel, start[i, j - 1]),
                       (d[i - 1, j] + indel, start[i - 1, j])]
            cost = swap_cost(swap, query, segment, i, j)
            if cost is not None:
                options.append((d[i - 2, j - 2] + cost, start[i - 2, j - 2]))
            d[i, j], start[i, j] = min(options, key=lambda option: option[0])
    ends = [j for j in range(1, n + 1) if start[m, j] < j]
    end = min(ends, key=lambda j: (d[m, j], j))
    return d[m, end], int(start[m, end]), end
