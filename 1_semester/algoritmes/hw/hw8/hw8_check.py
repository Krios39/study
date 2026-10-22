import json
import sys
import time

import networkx as nx
import numpy as np

from HW8_graph_helpers import check_closure, check_distribution, graph_arrays, homework_graphs


def matrix(rows):
    return np.array([[c == "1" for c in r] for r in rows])


def numpy_warshall(A):
    R = A | np.eye(len(A), dtype=bool)
    for k in range(len(A)):
        R |= np.outer(R[:, k], R[k])
    return R


def numpy_squaring(A):
    R = (A | np.eye(len(A), dtype=bool)).astype(np.int64)
    steps = 0
    while True:
        nxt = (R @ R > 0).astype(np.int64)
        steps += 1
        if np.array_equal(nxt, R):
            return R.astype(bool), steps
        R = nxt


def median_time(f, A):
    times = []
    for _ in range(3):
        t = time.perf_counter()
        f(A)
        times.append(time.perf_counter() - t)
    return sorted(times)[1]


def t1():
    res = json.load(open("HW8_T1_results.json"))
    graphs = homework_graphs()
    web = graphs["web_base"]
    nodes, A, _ = graph_arrays(web)
    Ai = A.astype(np.int64)
    assert np.array_equal(Ai @ Ai, np.array(res["A2"]))
    assert np.array_equal(Ai @ Ai @ Ai, np.array(res["A3"]))
    assert (Ai @ Ai @ Ai)[0, 4] == res["walk_count"] == len(res["walks_0_to_4"])
    R = matrix(res["closure"])
    check_closure(web, R, nodes)
    assert R.diagonal().all()
    sccs = sorted(sorted(c) for c in nx.strongly_connected_components(web))
    assert sccs == sorted(res["scc"])
    print("web_base: A^2, A^3, walk count, closure and SCCs agree with NumPy/NetworkX")

    chain = nx.path_graph(17, create_using=nx.DiGraph)
    cycle_and_isolate = nx.DiGraph([(0, 1), (1, 0)])
    cycle_and_isolate.add_node(2)
    check_closure(chain, matrix(res["chain17"]["closure"]), list(range(17)))
    check_closure(cycle_and_isolate, matrix(res["cycle_isolate"]["closure"]), [0, 1, 2])
    print("chain17 and cycle+isolate closures pass check_closure")

    numpy_times = []
    for c in res["clusters"]:
        g = graphs[f"clusters_{c['n']}"]
        cn, cA, _ = graph_arrays(g)
        check_closure(g, matrix(c["closure"]), cn)
        sizes = sorted(len(s) for s in nx.strongly_connected_components(g))
        assert sizes == sorted(c["scc_sizes"]), (sizes, c["scc_sizes"])
        Rw = numpy_warshall(cA)
        Rs, steps = numpy_squaring(cA)
        assert np.array_equal(Rw, matrix(c["closure"])) and np.array_equal(Rs, Rw) and steps == c["squarings"]
        tw = median_time(numpy_warshall, cA)
        ts = median_time(lambda M: numpy_squaring(M), cA)
        numpy_times.append({"n": c["n"], "warshall": tw, "squaring": ts, "squarings": steps})
        print(f"clusters_{c['n']}: check_closure ok, SCC sizes {sizes}, squarings {steps}; "
              f"NumPy medians: Warshall {tw:.4f} s, squaring {ts:.4f} s")
    json.dump(numpy_times, open("HW8_T1_numpy.json", "w"), indent=2)


def t2():
    res = json.load(open("HW8_T2_results.json"))
    web = homework_graphs()["web_base"]
    nodes, A, W = graph_arrays(web)
    n = len(nodes)
    for name, M in [("P_weighted", W), ("P_uniform", A.astype(float))]:
        P = M / np.where(M.sum(1, keepdims=True) == 0, 1, M.sum(1, keepdims=True))
        P[M.sum(1) == 0] = 1 / n
        assert np.allclose(P, res[name], atol=1e-15), name
        for row in P:
            check_distribution(row, n)
        p0 = np.zeros(n)
        p0[nodes.index(0)] = 1
        key = "predicted_weighted" if name == "P_weighted" else "predicted_uniform"
        for t in range(11):
            ref = p0 @ np.linalg.matrix_power(P, t)
            check_distribution(res[key][t], n)
            assert np.allclose(ref, res[key][t], atol=1e-14), (name, t)
    for run in res["runs"]:
        f = res["empirical"][f"{run['rule']}_{run['t']}_{run['M']}"]
        check_distribution(f, n)
        assert all(abs(x * run["M"] - round(x * run["M"])) < 1e-6 for x in f)
        pred = res["predicted_weighted" if run["rule"] == "weighted" else "predicted_uniform"][run["t"]]
        assert abs(np.abs(np.array(f) - pred).sum() - run["l1"]) < 1e-12
    print("T2: both P matrices, p0 P^t for t = 0..10, all frequency vectors and L1 values agree; check_distribution passed")


if __name__ == "__main__":
    t1()
    t2()
    sys.exit(0)
