import json
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx

from HW6_helpers import make_terrain, draw_terrain, neighbours, check_path, QUERIES


def as_path(cells):
    return [tuple(c) for c in cells]


def reference_cost(grid, source, target):
    g = nx.Graph()
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] != 0:
                for v, w in neighbours(grid, (r, c)):
                    g.add_edge((r, c), v, weight=w)
    return nx.dijkstra_path_length(g, source, target, weight="weight")


def t4():
    print("=== T4 ===")
    results = json.load(open("HW6_T4_results.json"))
    source, target = QUERIES[0]
    fig, axes = plt.subplots(1, 2, figsize=(16, 7.6), constrained_layout=True)
    for ax, case in zip(axes, ("A", "B")):
        grid = make_terrain(case)
        bfs_path = as_path(results[case]["bfs_path"])
        dijkstra_path = as_path(results[case]["dijkstra_path"])
        for name, path in (("BFS", bfs_path), ("Dijkstra", dijkstra_path)):
            cost = check_path(grid, path, source, target)
            print(case, name, "edges:", len(path) - 1, "cost:", cost)
        ref = reference_cost(grid, source, target)
        print(case, "NetworkX Dijkstra cost:", ref, "match:", ref == results[case]["dijkstra_cost"])
        draw_terrain(grid, path=dijkstra_path, comparison_path=bfs_path,
                     source=source, target=target, ax=ax,
                     title=f"Map {case}: Dijkstra (solid) and BFS (dashed)")
        ax1 = draw_terrain(grid, path=dijkstra_path, comparison_path=bfs_path,
                           source=source, target=target,
                           title=f"Map {case}: Dijkstra (solid) and BFS (dashed)")
        ax1.figure.savefig(f"HW6_map_{case}_routes.png", dpi=180)
        plt.close(ax1.figure)
    fig.savefig("HW6_routes_AB.png", dpi=150)
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(16, 7.6), constrained_layout=True)
    for ax, case in zip(axes, ("A", "B")):
        grid = make_terrain(case)
        settled = as_path(results[case]["dijkstra_settled"])
        draw_terrain(grid, path=as_path(results[case]["dijkstra_path"]), settled=settled,
                     source=source, target=target, ax=ax,
                     title=f"Map {case}: Dijkstra settled {len(settled)} vertices (cost {results[case]['dijkstra_cost']})")
    fig.savefig("HW6_dijkstra_settled_AB.png", dpi=150)
    plt.close(fig)


def t5():
    print("=== T5 ===")
    cases = json.load(open("HW6_T5_results.json"))
    for case in cases:
        grid = make_terrain(case["map"])
        source, target = QUERIES[case["query"] - 1]
        d = check_path(grid, as_path(case["dijkstra_path"]), source, target)
        a = check_path(grid, as_path(case["astar_path"]), source, target)
        print(case["map"], f"Q{case['query']}", "Dijkstra:", d, "A*:", a, "agree:", d == a == case["cost"])

    worst = max(cases, key=lambda c: c["ratio"])
    case, q = worst["map"], worst["query"]
    grid = make_terrain(case)
    source, target = QUERIES[q - 1]
    for name, key, file in (("Dijkstra", "dijkstra", "HW6_dijkstra_search.png"), ("A*", "astar", "HW6_astar_search.png")):
        settled = as_path(worst[f"{key}_settled"])
        ax = draw_terrain(grid, path=as_path(worst[f"{key}_path"]), settled=settled,
                          source=source, target=target,
                          title=f"{name}: map {case}, Q{q} ({len(settled)} settled, cost {worst['cost']})")
        ax.figure.savefig(file, dpi=180)
        plt.close(ax.figure)
    print("Drew map", case, f"Q{q}")


def b2(wall="59", q=1):
    print("=== B2 ===")
    rows = json.load(open("HW6_B2_results.json"))[wall]
    grid = make_terrain("B")
    for row in rows:
        source, target = QUERIES[row["query"] - 1]
        m = check_path(grid, as_path(row["manhattan_path"]), source, target)
        r = check_path(grid, as_path(row["relaxed_path"]), source, target)
        ref = reference_cost(grid, source, target)
        print(f"Q{row['query']}", "Manhattan A*:", m, "relaxed A*:", r, "NetworkX:", ref, "agree:", m == r == ref)

    row = rows[q - 1]
    source, target = QUERIES[q - 1]
    for name, key, file in (("Manhattan A*", "manhattan", "HW6_B2_manhattan.png"),
                            (f"Relaxed-map A* (wall {wall} kept)", "relaxed", "HW6_B2_relaxed.png")):
        settled = as_path(row[f"{key}_settled"])
        ax = draw_terrain(grid, path=as_path(row[f"{key}_path"]), settled=settled,
                          source=source, target=target,
                          title=f"{name}: map B, Q{q} ({len(settled)} settled, cost {row['cost']})")
        ax.figure.savefig(file, dpi=180)
        plt.close(ax.figure)


if __name__ == "__main__":
    tasks = {"t4": t4, "t5": t5, "b2": b2}
    for name in sys.argv[1:] or tasks:
        tasks[name]()
