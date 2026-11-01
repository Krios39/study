import json
import time
from pathlib import Path

import numpy as np
from scipy.optimize import LinearConstraint, linprog, milp
from scipy.sparse import coo_matrix, csr_matrix
from scipy.sparse.csgraph import connected_components

HW = Path(__file__).resolve().parents[2]
OUT = HW / "src" / "bin" / "tsp2000"
BUDGET = 2400
NEIGHBOURS = 10
started = time.time()


def log(text):
    line = f"[{time.time() - started:7.1f}s] {text}"
    print(line, flush=True)
    with open(OUT / "HW9_B2_exact_log.txt", "a", encoding="utf-8") as f:
        f.write(line + "\n")


points = np.array([[int(v) for v in line.split()[1:]] for line in (HW / "HW9_TSP_2000.txt").read_text().splitlines()
                   if line.strip() and not line.startswith("#")], dtype=float)
n = len(points)
dist = np.sqrt(((points[:, None, :] - points[None, :, :]) ** 2).sum(axis=2))
iu, ju = np.triu_indices(n, 1)
all_len = dist[iu, ju]


def tour_len(tour):
    return float(dist[tour, np.roll(tour, -1)].sum())


best_tour = np.array([int(v) - 1 for v in (OUT / "HW9_B2_hungarian.txt").read_text().split()])
best_len = tour_len(best_tour)
log(f"start tour {best_len:.6f}")

order = np.argsort(dist + np.eye(n) * 1e12, axis=1)[:, :NEIGHBOURS]
edges = {(min(i, int(j)), max(i, int(j))) for i in range(n) for j in order[i]}
edges |= {(min(int(a), int(b)), max(int(a), int(b))) for a, b in zip(best_tour, np.roll(best_tour, -1))}
edges = np.array(sorted(edges))
u, v = edges[:, 0], edges[:, 1]
cuts = []
seen = set()
log(f"candidate edges {len(u)}")


def add_cut(mask):
    if mask.sum() > n / 2:
        mask = ~mask
    key = mask.tobytes()
    if key in seen:
        return False
    seen.add(key)
    cuts.append(mask)
    return True


def degree_matrix():
    m = len(u)
    return coo_matrix((np.ones(2 * m), (np.r_[u, v], np.r_[np.arange(m), np.arange(m)])), shape=(n, m)).tocsr()


def cut_matrix():
    rows, cols = [], []
    for r, mask in enumerate(cuts):
        crossing = np.nonzero(mask[u] ^ mask[v])[0]
        rows.append(np.full(len(crossing), r))
        cols.append(crossing)
    if not cuts:
        return csr_matrix((0, len(u)))
    rows, cols = np.concatenate(rows), np.concatenate(cols)
    return coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(len(cuts), len(u))).tocsr()


def components(selected):
    graph = coo_matrix((np.ones(selected.sum()), (u[selected], v[selected])), shape=(n, n))
    return connected_components(graph, directed=False)


def separate(x):
    added = 0
    for t in (1e-6, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9):
        count, labels = components(x >= t)
        if count == 1:
            continue
        cross_value = {}
        for label in range(count):
            mask = labels == label
            value = x[mask[u] ^ mask[v]].sum()
            if value < 2 - 1e-6:
                added += add_cut(mask)
                cross_value[label] = value
    return added


def merge_cycles(selected):
    adjacency = [[] for _ in range(n)]
    for a, b in zip(u[selected], v[selected]):
        adjacency[a].append(int(b))
        adjacency[b].append(int(a))
    seen_nodes = np.zeros(n, dtype=bool)
    cycles = []
    for s in range(n):
        if seen_nodes[s]:
            continue
        cycle, prev, cur = [], -1, s
        while not seen_nodes[cur]:
            seen_nodes[cur] = True
            cycle.append(cur)
            options = [w for w in adjacency[cur] if w != prev] or adjacency[cur]
            prev, cur = cur, options[0]
        cycles.append(cycle)
    count = len(cycles)
    while len(cycles) > 1:
        cycles.sort(key=len)
        small = np.array(cycles[0])
        rest = np.array(cycles[1])
        best = (np.inf, 0, 0, False, 1)
        for index in range(1, len(cycles)):
            rest = np.array(cycles[index])
            a, b = small, np.roll(small, -1)
            c, e = rest, np.roll(rest, -1)
            base = dist[a, b][:, None] + dist[c, e][None, :]
            same = dist[a[:, None], e[None, :]] + dist[c[None, :], b[:, None]] - base
            flip = dist[a[:, None], c[None, :]] + dist[e[None, :], b[:, None]] - base
            for table, flag in ((same, False), (flip, True)):
                i, j = np.unravel_index(np.argmin(table), table.shape)
                if table[i, j] < best[0]:
                    best = (float(table[i, j]), int(i), int(j), flag, index)
        _, i, j, flag, index = best
        other = cycles[index]
        piece = other[j + 1:] + other[:j + 1]
        if flag:
            piece.reverse()
        joined = cycles[0][:i + 1] + piece + cycles[0][i + 1:]
        cycles = [joined] + [c for k, c in enumerate(cycles) if k not in (0, index)]
    return np.array(cycles[0]), count


def save_best(tour, source):
    global best_tour, best_len
    length = tour_len(tour)
    if length < best_len - 1e-9:
        best_tour, best_len = tour, length
        (OUT / "HW9_B2_exact.txt").write_text("\n".join(str(i + 1) for i in tour) + "\n", encoding="ascii")
        log(f"new best tour {length:.6f} from {source}")


def write_results(lower, status):
    (OUT / "HW9_B2_exact_results.json").write_text(json.dumps({
        "method": "HiGHS via scipy: subtour LP with pricing over all edges, then integer solves with lazy subtour cuts",
        "lower_bound": lower, "length": best_len, "gap_percent": None if lower is None else 100 * (best_len / lower - 1),
        "status": status, "seconds": time.time() - started, "candidate_edges": int(len(u)), "cuts": len(cuts),
    }, indent=2), encoding="utf-8")


lower = None
result = None
round_number = 0
while time.time() - started < BUDGET * 0.5:
    round_number += 1
    c = dist[u, v]
    A_ub = -cut_matrix() if cuts else None
    b_ub = -2 * np.ones(len(cuts)) if cuts else None
    result = linprog(c, A_ub=A_ub, b_ub=b_ub, A_eq=degree_matrix(), b_eq=2 * np.ones(n), bounds=(0, 1), method="highs")
    if result.status != 0:
        log(f"lp status {result.status}: {result.message}")
        break
    added = separate(result.x)
    if added:
        log(f"lp round {round_number}: value {result.fun:.3f}, added {added} cuts, total {len(cuts)}")
        continue
    y = result.eqlin.marginals
    rc = all_len - y[iu] - y[ju]
    if cuts:
        for mask, pi in zip(cuts, result.ineqlin.marginals):
            if pi < -1e-12:
                rc += pi * (mask[iu] ^ mask[ju])
    negative = np.nonzero(rc < -1e-7)[0]
    if len(negative):
        keep = negative[np.argsort(rc[negative])[:2000]]
        new = np.c_[iu[keep], ju[keep]]
        u, v = np.r_[u, new[:, 0]], np.r_[v, new[:, 1]]
        log(f"lp round {round_number}: value {result.fun:.3f}, priced in {len(keep)} of {len(negative)} edges")
        continue
    lower = float(result.fun)
    log(f"lower bound {lower:.3f} after {round_number} rounds; record gap {100 * (best_len / lower - 1):.3f}%")
    keep_cut = [mask for mask, pi in zip(cuts, result.ineqlin.marginals) if pi < -1e-9] if cuts else []
    log(f"active cuts {len(keep_cut)} of {len(cuts)}")
    cuts = keep_cut
    seen = {mask.tobytes() for mask in cuts}
    fix = rc <= best_len - lower + 1e-6
    u, v = iu[fix], ju[fix]
    log(f"edges after reduced-cost fixing {len(u)} of {len(rc)}")
    break

write_results(lower, "lp finished" if lower else "lp stopped")

status = "time limit"
while time.time() - started < BUDGET:
    remaining = BUDGET - (time.time() - started)
    rows = [degree_matrix()]
    low, high = [2 * np.ones(n)], [2 * np.ones(n)]
    if cuts:
        rows.append(cut_matrix())
        low.append(2 * np.ones(len(cuts)))
        high.append(np.inf * np.ones(len(cuts)))
    from scipy.sparse import vstack
    constraint = LinearConstraint(vstack(rows).tocsr(), np.concatenate(low), np.concatenate(high))
    solved = milp(dist[u, v], constraints=constraint, integrality=np.ones(len(u)), bounds=(0, 1),
                  options={"time_limit": min(remaining, 600), "mip_rel_gap": 0})
    log(f"milp status {solved.status}, value {solved.fun}, bound {getattr(solved, 'mip_dual_bound', None)}, edges {len(u)}, cuts {len(cuts)}")
    if solved.x is None:
        continue
    selected = solved.x > 0.5
    count, labels = components(selected)
    tour, cycles = merge_cycles(selected)
    save_best(tour, f"milp with {cycles} cycles")
    if count == 1:
        if solved.status == 0:
            status = "optimal"
            lower = float(solved.fun)
            log(f"proved optimal: {best_len:.6f}")
            write_results(lower, status)
            break
        status = "single tour, integer solve hit its time limit"
        continue
    added = sum(add_cut(labels == label) for label in range(count))
    log(f"{count} cycles, added {added} cuts")
    write_results(lower, status)

write_results(lower, status)
log(f"finished: {status}, best {best_len:.6f}, lower bound {lower}")
