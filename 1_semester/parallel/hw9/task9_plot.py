import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
WEAK = {"W_none": ("one-level, no coarse", BLUE, "o"),
        "W_bal_2P": ("balanced, Cx=Cy=2·Px (coarse grows)", ORANGE, "s"),
        "W_bal_4": ("balanced, Cx=Cy=4 (coarse fixed)", AQUA, "^")}
STRONG = {"S_none": ("one-level, no coarse", BLUE, "o"),
          "S_bal_8": ("balanced, Cx=Cy=8", ORANGE, "s")}
WORKERS = {2: BLUE, 3: ORANGE, 5: AQUA, 7: "#6250d6"}


def load_runs(path="dd_runs.json"):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def summarise(runs):
    rows = []
    for r in runs:
        if r["rep"] < 0:
            continue
        x = r["res"]
        rows.append({"series": r["series"], "P": r["P"], "ranks": r["cfg"]["ranks"], "Nx": r["cfg"]["nx"],
                     "Px": r["cfg"]["px"], "iterations": x["iterations"], "residual": x["relative_residual"],
                     "status": r["status"], "coarse_dim": x["coarse_dimension"], "setup": x["setup_seconds"],
                     "solve": x["solve_seconds"],
                     "local": max(t["local_seconds"] for t in x["rank_timings"]),
                     "coarse": max(t["coarse_seconds"] for t in x["rank_timings"])})
    frame = pd.DataFrame(rows)
    return frame.groupby(["series", "P"], as_index=False).agg(
        ranks=("ranks", "first"), Nx=("Nx", "first"), Px=("Px", "first"), iterations=("iterations", "median"),
        iter_min=("iterations", "min"), iter_max=("iterations", "max"), residual=("residual", "max"),
        status=("status", lambda s: ",".join(sorted(set(s)))), reps=("solve", "size"), coarse_dim=("coarse_dim", "first"),
        setup=("setup", "median"), solve=("solve", "median"), solve_min=("solve", "min"), solve_max=("solve", "max"),
        local=("local", "median"), coarse=("coarse", "median"))


def _style(ax, xlabel, ylabel, title):
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title, loc="left", fontsize=11)
    ax.grid(True, color="#e6e6e3", linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)


def _series(ax, frame, spec, column, x="ranks"):
    for key, (label, colour, marker) in spec.items():
        d = frame[frame.series == key].sort_values(x)
        ax.plot(d[x], d[column], color=colour, marker=marker, markersize=7, linewidth=2, label=label)


def plot_weak(frame, out="plots"):
    os.makedirs(out, exist_ok=True)
    fig, ax = plt.subplots(figsize=(7, 4.2))
    _series(ax, frame, WEAK, "solve")
    _style(ax, "subdomains = MPI ranks (each 64×64 owned points)", "median solve time, s", "Weak scaling: solve time")
    ax.set_ylim(bottom=0)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(f"{out}/weak_time.png", dpi=150)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 4.2))
    _series(ax, frame, WEAK, "iterations")
    _style(ax, "subdomains = MPI ranks", "outer CG iterations to rtol 1e-8", "Weak scaling: outer iterations")
    ax.set_ylim(bottom=0)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(f"{out}/weak_iterations.png", dpi=150)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 4.2))
    for key, (label, colour, marker) in WEAK.items():
        d = frame[frame.series == key].sort_values("ranks")
        ax.plot(d.ranks, d.solve.iloc[0] / d.solve, color=colour, marker=marker, markersize=7, linewidth=2, label=label)
    _style(ax, "subdomains = MPI ranks", "E_weak = T(first) / T(P)", "Weak-scaling efficiency (solve time)")
    ax.set_ylim(bottom=0)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(f"{out}/weak_efficiency.png", dpi=150)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 4.2))
    for key, (label, colour, marker) in WEAK.items():
        d = frame[frame.series == key].sort_values("ranks")
        ax.plot(d.ranks, d.solve / d.iterations * 1000, color=colour, marker=marker, markersize=7, linewidth=2, label=label)
    _style(ax, "subdomains = MPI ranks", "solve time per iteration, ms", "Cost of one outer iteration")
    ax.set_ylim(bottom=0)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(f"{out}/weak_per_iteration.png", dpi=150)
    plt.close(fig)


def plot_strong(frame, out="plots"):
    fig, ax = plt.subplots(figsize=(7, 4.2))
    for key, (label, colour, marker) in STRONG.items():
        d = frame[frame.series == key].sort_values("ranks")
        ax.plot(d.ranks, d.solve.iloc[0] / d.solve, color=colour, marker=marker, markersize=7, linewidth=2, label=label)
    ranks = sorted(frame[frame.series.isin(STRONG)].ranks.unique())
    ax.plot(ranks, ranks, color="#8a8a85", linestyle="--", linewidth=1, label="ideal")
    _style(ax, "MPI ranks (Nx=Ny=256, Px=Py=4 fixed)", "speedup T(1)/T(p), solve time", "Strong scaling: same 16 subdomains")
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(f"{out}/strong_speedup.png", dpi=150)
    plt.close(fig)


def plot_histories(runs, out="plots"):
    picks = {1: "#86b6ef", 2: "#5598e7", 4: "#2a78d6", 8: "#104281"}
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.2), sharey=True)
    for ax, key, title in ((axes[0], "W_none", "One-level"), (axes[1], "W_bal_2P", "Balanced, Cx=Cy=2·Px")):
        for r in runs:
            if r["series"] == key and r["rep"] == 0 and r["P"] in picks:
                h = np.array(r["hist"])
                ax.semilogy(h[:, 0], h[:, 1], color=picks[r["P"]], linewidth=2, label=f"{r['P'] ** 2} subdomain{'s' if r['P'] > 1 else ''}")
        _style(ax, "outer iteration", "relative residual", title)
        ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(f"{out}/residual_histories.png", dpi=150)
    plt.close(fig)


def plot_granularity(path="results_9_1.csv", out="plots"):
    d = pd.read_csv(path).groupby(["P", "m"], as_index=False).seconds.median()
    fig, ax = plt.subplots(figsize=(7, 4.2))
    for P, colour in WORKERS.items():
        s = d[d.P == P].sort_values("m")
        ax.plot(s.m, s.seconds, color=colour, marker="o", markersize=7, linewidth=2, label=f"P={P} ({P - 1} workers)")
    ax.set_xscale("log", base=2)
    ax.set_yscale("log")
    _style(ax, "blocks per side m (N=1920)", "median time, s", "Manager-worker: task granularity")
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(f"{out}/mw_granularity.png", dpi=150)
    plt.close(fig)
    return d


def main():
    runs = load_runs()
    frame = summarise(runs)
    frame.to_csv("dd_summary.csv", index=False)
    plot_weak(frame)
    plot_strong(frame)
    plot_histories(runs)
    d = plot_granularity()
    print(frame.to_string())
    print(d.pivot(index="m", columns="P", values="seconds").to_string())
