import glob
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

BLUE, ORANGE, AQUA, GREY = "#2a78d6", "#eb6834", "#1baf7a", "#8a8a85"
N_STRONG, N_WEAK = 7200, 256


def load(pattern="cluster/results_*.csv"):
    frame = pd.concat([pd.read_csv(p) for p in sorted(glob.glob(pattern))], ignore_index=True)
    return frame.groupby(["kind", "label", "nodes", "P", "N", "n"], as_index=False).time.agg(
        time="median", t_min="min", t_max="max", runs="size")


def _style(ax, xlabel, ylabel, title):
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title, loc="left", fontsize=11)
    ax.grid(True, color="#e6e6e3", linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)


def _save(fig, path):
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def strong_table(d):
    s = d[(d.kind == "strong") & (d.N == N_STRONG) & (d.nodes == 1)].sort_values("P").reset_index(drop=True)
    t1 = s.loc[s.P == 1, "time"].iloc[0]
    s["speedup"] = t1 / s.time
    s["efficiency"] = s.speedup / s.P
    s["gflops"] = 2 * N_STRONG ** 3 / s.time / 1e9
    return s


def weak_table(d):
    w = d[(d.kind == "weak") & (d.n == N_WEAK) & (d.nodes == 1)].sort_values("P").reset_index(drop=True)
    t1 = w.loc[w.P == 1, "time"].iloc[0]
    w["scaled_eff"] = t1 / w.time
    w["work_per_proc"] = w.P ** 2
    w["scaled_eff_work"] = w.scaled_eff * w.P ** 2
    w["gflops"] = 2 * w.N.astype(float) ** 3 / w.time / 1e9
    return w


def bonus_table(d):
    b = d[(d.kind == "strong") & (d.N == N_STRONG)]
    one = b[b.nodes == 1].set_index("P").time
    many = b[(b.nodes == b.P) & (b.P > 1)].set_index("P").time
    k = sorted(set(one.index) & set(many.index))
    return pd.DataFrame({"K": k, "one_node_K_cores": [one[i] for i in k], "K_nodes_one_core": [many[i] for i in k]})


def plot_speedup(s, out):
    fig, ax = plt.subplots(figsize=(7, 4.2))
    ax.plot(s.P, s.P, color=GREY, linestyle="--", linewidth=1, label="ideal S = P")
    ax.plot(s.P, s.speedup, color=BLUE, marker="o", markersize=7, linewidth=2, label=f"ring, N = {N_STRONG}")
    for p, v in zip(s.P, s.speedup):
        ax.annotate(f"{v:.1f}", (p, v), textcoords="offset points", xytext=(0, 8), ha="center", fontsize=9)
    _style(ax, "processes P (one node)", "relative speedup S = T1 / TP", "E10.1  Relative speedup (strong scaling)")
    ax.set_xticks(s.P)
    ax.legend(frameon=False)
    _save(fig, f"{out}/speedup.png")


def plot_efficiency(s, out):
    fig, ax = plt.subplots(figsize=(7, 4.2))
    ax.axhline(1, color=GREY, linestyle="--", linewidth=1, label="ideal E = 1")
    ax.plot(s.P, s.efficiency, color=ORANGE, marker="s", markersize=7, linewidth=2, label=f"ring, N = {N_STRONG}")
    for p, v in zip(s.P, s.efficiency):
        ax.annotate(f"{v:.2f}", (p, v), textcoords="offset points", xytext=(0, 8), ha="center", fontsize=9)
    _style(ax, "processes P (one node)", "efficiency E = S / P", "E10.2  Parallel efficiency")
    ax.set_xticks(s.P)
    ax.set_ylim(0, max(1.15, s.efficiency.max() + 0.1))
    ax.legend(frameon=False)
    _save(fig, f"{out}/efficiency.png")


def plot_weak(w, out):
    fig, ax = plt.subplots(figsize=(7, 4.2))
    ax.axhline(1, color=GREY, linestyle="--", linewidth=1, label="ideal")
    ax.plot(w.P, w.scaled_eff, color=AQUA, marker="^", markersize=7, linewidth=2,
            label="E_S = T1(n) / TP(nP, P)  (as defined)")
    ax.plot(w.P, w.scaled_eff_work, color=BLUE, marker="o", markersize=7, linewidth=2,
            label="E_S × P²  (per-process work grows as P²)")
    _style(ax, "processes P (one node)", "scaled efficiency", f"E10.3  Weak scaling, block n = {N_WEAK}, N = n·P")
    ax.set_yscale("log")
    ax.set_xticks(w.P)
    ax.legend(frameon=False, fontsize=9)
    _save(fig, f"{out}/weak_scaled_efficiency.png")


def plot_bonus(b, out):
    fig, ax = plt.subplots(figsize=(7, 4.2))
    x = range(len(b))
    ax.bar([i - 0.2 for i in x], b.one_node_K_cores, width=0.4, color=BLUE, label="1 node × K cores")
    ax.bar([i + 0.2 for i in x], b.K_nodes_one_core, width=0.4, color=ORANGE, label="K nodes × 1 core")
    ax.set_xticks(list(x), [str(k) for k in b.K])
    _style(ax, "K processes", "median time, s", f"Bonus 10: placement of K processes, N = {N_STRONG}")
    ax.legend(frameon=False)
    _save(fig, f"{out}/bonus_placement.png")


def main():
    os.makedirs("plots", exist_ok=True)
    d = load()
    s, w, b = strong_table(d), weak_table(d), bonus_table(d)
    s.to_csv("summary_strong.csv", index=False)
    w.to_csv("summary_weak.csv", index=False)
    b.to_csv("summary_bonus.csv", index=False)
    plot_speedup(s, "plots")
    plot_efficiency(s, "plots")
    plot_weak(w, "plots")
    if len(b):
        plot_bonus(b, "plots")
    pd.set_option("display.width", 200)
    print(s.to_string(index=False))
    print(w.to_string(index=False))
    print(b.to_string(index=False))


if __name__ == "__main__":
    main()
