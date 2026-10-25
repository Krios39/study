import json
import sys
import time

import networkx as nx
import numpy as np

from HW8_graph_helpers import check_closure, check_distribution, check_pagerank, graph_arrays, homework_graphs


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


def t3():
    res = json.load(open("HW8_T3_results.json"))
    graphs = homework_graphs()
    web = graphs["web_base"]
    nodes = list(web)
    for r in res["results"]:
        check_distribution(r["vector"], len(nodes))
        if r["rho"] > 0:
            assert r["converged"]
            check_pagerank(web, dict(zip(nodes, r["vector"])), rho=r["rho"])
    check_distribution(res["walk"]["frequencies"], len(nodes))
    big = graphs["clusters_256"]
    check_distribution(res["clusters"]["vector"], len(big))
    check_pagerank(big, dict(zip(list(big), res["clusters"]["vector"])), rho=res["clusters"]["rho"])
    print("T3: check_pagerank passed for rho = 0.05, 0.10, 0.20 on web_base and rho = 0.10 on clusters_256")


def t4():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from HW8_graph_helpers import check_flow, draw_flow, draw_residual
    res = json.load(open("HW8_T4_results.json"))
    small = homework_graphs()["allocation_small"]
    cert = check_flow(small, res["flow"], res["source_side"])
    assert cert["flow_value"] == res["value"] == res["cut_capacity"]
    value, reference = nx.maximum_flow(small, "s", "t", capacity="capacity")
    assert value == res["value"]
    fig, axes = plt.subplots(1, 2, figsize=(14, 5), constrained_layout=True)
    draw_flow(small, res["flow"], cut=res["source_side"], ax=axes[0], title="Final flow / capacity, cut {s}")
    draw_residual(small, res["flow"], ax=axes[1], title="Final residual capacities")
    fig.savefig("HW8_T4_helpers.svg", bbox_inches="tight")
    print(f"T4: check_flow {cert}; NetworkX maximum_flow value {value}, its flow {reference}")


def t5():
    from HW8_graph_helpers import check_flow
    res = json.load(open("HW8_T5_results.json"))
    graphs = homework_graphs()
    small = graphs["allocation_small"]
    cert = check_flow(small, res["small"]["flow"], res["small"]["source_side"])
    assert cert["flow_value"] == res["small"]["value"] == 2
    large = graphs["allocation_large"]
    for run in res["runs"]:
        g = large.copy()
        for name, cap, base in zip(run["sessions"], run["capacity"], [large[j]["t"]["capacity"] for j in run["sessions"]]):
            if cap != base:
                g[name]["t"]["capacity"] = cap
        ids = {"source": "s", "sink": "t"}
        flow = {ids.get(u, u): {ids.get(v, v): x for v, x in d.items()} for u, d in run["flow"].items()}
        cert = check_flow(g, flow, [ids.get(u, u) for u in run["source_side"]])
        students = [u for u, d in g.nodes(data=True) if d.get("kind") == "student"]
        for u in students:
            chosen = [v for v, x in flow.get(u, {}).items() if x > 0]
            assert len(chosen) <= 1 and all(g.has_edge(u, v) for v in chosen)
        assert sum(1 for u in students if not flow.get(u)) == run["unassigned"]
        value = nx.maximum_flow_value(g, "s", "t", capacity="capacity")
        assert value == cert["flow_value"] == cert["cut_capacity"] == run["value"]
        print(f"T5 {run['name']}: check_flow {cert}, NetworkX value {value}, one compatible session per assigned student")


def b1():
    res = json.load(open("HW8_B1_results.json"))
    web = homework_graphs()["web_base"]
    nodes = list(web)
    for run in res["runs"]:
        v = dict(zip(nodes, run["preference"]))
        ref = nx.pagerank(web, alpha=1 - res["rho"], personalization=v, dangling=v, weight="weight", tol=1e-14 / len(web), max_iter=10000)
        check_distribution(run["vector"], len(nodes))
        np.testing.assert_allclose(run["vector"], [ref[u] for u in nodes], rtol=0, atol=1e-9)
        print(f"B1 {run['key']}: NetworkX personalised PageRank agrees within 1e-9")
    esc = json.load(open("HW8_B1_escape.json"))
    prefs = [run["preference"] for run in res["runs"]]
    for c in esc["candidates"]:
        g = web.copy()
        g.add_edge(c["from"], c["to"], weight=esc["weight_of_new_link"])
        for k, pref in enumerate(prefs):
            v = dict(zip(nodes, pref))
            ref = nx.pagerank(g, alpha=1 - res["rho"], personalization=v, dangling=v, weight="weight", tol=1e-14 / len(g), max_iter=10000)
            np.testing.assert_allclose(c["vectors"][k], [ref[u] for u in nodes], rtol=0, atol=1e-9)
    escape = homework_graphs()["web_escape"]
    ref = nx.pagerank(escape, alpha=1 - res["rho"], weight="weight", tol=1e-14 / len(escape), max_iter=10000)
    course = [c for c in esc["candidates"] if c["from"] == 10 and c["to"] == 0][0]
    np.testing.assert_allclose(course["vectors"][0], [ref[u] for u in nodes], rtol=0, atol=1e-9)
    print(f"B1 escape: all {len(esc['candidates'])} x 3 vectors agree with NetworkX; Partner B -> Home equals the course's web_escape")


def contracted(g, s, t):
    comps = list(nx.strongly_connected_components(g))
    of = {v: i for i, c in enumerate(comps) for v in c}
    h = nx.DiGraph(source=of[s], sink=of[t])
    h.add_nodes_from(range(len(comps)))
    for u, v, d in g.edges(data=True):
        if of[u] != of[v]:
            h.add_edge(of[u], of[v], capacity=h.get_edge_data(of[u], of[v], {}).get("capacity", 0) + d["capacity"])
    return h, of


def b2():
    from HW8_graph_helpers import check_flow
    res = json.load(open("HW8_B2_results.json"))
    for key in ("example", "minimal"):
        ex = res[key]
        g = nx.DiGraph(source="s", sink="t")
        g.add_weighted_edges_from(ex["edges"], weight="capacity")
        assert sorted(sorted(c) for c in nx.strongly_connected_components(g)) == sorted(sorted(c) for c in ex["sccs"])
        flow = {}
        for u, v, c, f in ex["original"]["flow"]:
            flow.setdefault(u, {})[v] = f
        cert = check_flow(g, flow, ex["original"]["source_side"])
        h, of = contracted(g, "s", "t")
        names = ex["contracted"]["nodes"]
        idx = {}
        for i, name in enumerate(names):
            members = list(name)
            idx[name] = of[members[0]]
        hf = {}
        for u, v, c, f in ex["contracted"]["flow"]:
            hf.setdefault(idx[u], {})[idx[v]] = f
        hcert = check_flow(h, hf, [idx[x] for x in ex["contracted"]["source_side"]])
        assert cert["flow_value"] == nx.maximum_flow_value(g, "s", "t", capacity="capacity") == ex["original"]["value"]
        assert hcert["flow_value"] == nx.maximum_flow_value(h, h.graph["source"], h.graph["sink"], capacity="capacity") == ex["contracted"]["value"]
        print(f"B2 {key}: original {cert}, contracted {hcert}")
    agree, gap = 0, 0
    for var in res["variants"]:
        g = nx.DiGraph()
        for edge, c in zip(res["topology"], var["capacities"]):
            u, v = edge.split(" -> ")
            g.add_edge(u, v, capacity=c)
        h, of = contracted(g, "s", "t")
        fo = nx.maximum_flow_value(g, "s", "t", capacity="capacity")
        fc = nx.maximum_flow_value(h, of["s"], of["t"], capacity="capacity")
        assert fo == var["original"] and fc == var["contracted"] and fc >= fo
        agree += fo == fc
        gap = max(gap, fc - fo)
    assert agree == res["agree"] and gap == res["largest_gap"]
    import itertools
    names = ["s", "x", "t"]
    pairs = [(u, v) for u in names for v in names if u != v]
    checked = found = 0
    best = None
    for mask in range(1 << len(pairs)):
        chosen = [pairs[k] for k in range(len(pairs)) if mask >> k & 1]
        for caps in itertools.product(range(1, 4), repeat=len(chosen)):
            g = nx.DiGraph()
            g.add_nodes_from(names)
            for (u, v), c in zip(chosen, caps):
                g.add_edge(u, v, capacity=c)
            h, of = contracted(g, "s", "t")
            if of["s"] == of["t"]:
                continue
            checked += 1
            if nx.maximum_flow_value(h, of["s"], of["t"], capacity="capacity") > nx.maximum_flow_value(g, "s", "t", capacity="capacity"):
                found += 1
                best = min(best or (99, 99), (len(chosen), sum(caps)))
    s3 = [x for x in res["searches"] if x["vertices"] == 3][0]
    assert (checked, found, best) == (s3["checked"], s3["counterexamples"], (s3["minimum_edges"], s3["minimum_total_capacity"]))
    print(f"B2 search: NetworkX repeats the 3-vertex enumeration: {checked} graphs, {found} counterexamples, minimum {best}")
    print(f"B2 variants: NetworkX confirms {agree}/{len(res['variants'])} agree, largest gap {gap}, never contracted < original")


if __name__ == "__main__":
    t1()
    t2()
    t3()
    t4()
    t5()
    b1()
    b2()
    sys.exit(0)
