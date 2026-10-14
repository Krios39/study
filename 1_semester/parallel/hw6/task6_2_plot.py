import argparse
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

LABELS = {"row": "row-block (Allgather)", "col": "column-block (Allreduce)",
          "rsb": "column-block (Reduce_scatter_block)", "cell": "cell-block 2D"}


def summarise(df, keys):
    g = df.groupby(keys)
    out = g[["setup", "mult", "total"]].median()
    out["total_min"] = g["total"].min()
    out["total_max"] = g["total"].max()
    out["runs"] = g.size()
    return out.reset_index()


def strong_scaling(df, outdir):
    d = df[df.experiment == "scaling"]
    if d.empty:
        return
    s = summarise(d, ["method", "N", "K", "P"])
    rows = []
    for (N, K), sub in s.groupby(["N", "K"]):
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.2))
        Pmax = sub.P.max()
        for method, m in sub.groupby("method"):
            m = m.sort_values("P")
            t1 = m[m.P == 1].total
            if t1.empty:
                print(f"note: no P=1 run for {method}, N={N}, K={K}; speedup not computed")
                continue
            t1 = float(t1.iloc[0])
            speed = t1 / m.total
            ax1.errorbar(m.P, m.total, yerr=[m.total - m.total_min, m.total_max - m.total],
                         marker="o", capsize=3, label=LABELS.get(method, method))
            ax2.plot(m.P, speed, marker="o", label=LABELS.get(method, method))
            for _, r in m.iterrows():
                sp = t1 / r.total
                rows.append([method, N, K, r.P, r.setup, r.mult, r.total, sp, sp / r.P])
        ps = np.array(sorted(sub.P.unique()))
        ax2.plot(ps, ps, "k--", label="ideal (linear)")
        for ax in (ax1, ax2):
            ax.set_xscale("log", base=2)
            ax.set_xticks(ps)
            ax.set_xticklabels([str(p) for p in ps])
            ax.set_xlabel("processes P")
            ax.grid(alpha=0.3)
        ax1.set_ylabel("total time, s (median, bars = min..max)")
        ax2.set_ylabel("speedup T(1)/T(P)")
        ax1.set_title(f"Execution time, N={N}, K={K}")
        ax2.set_title(f"Speedup, N={N}, K={K}")
        ax2.legend(fontsize=8)
        fig.tight_layout()
        path = os.path.join(outdir, f"scaling_N{N}_K{K}.png")
        fig.savefig(path, dpi=130)
        plt.close(fig)
        print("saved", path)
    table = pd.DataFrame(rows, columns=["method", "N", "K", "P", "setup", "mult", "total", "speedup", "efficiency"])
    table.to_csv(os.path.join(outdir, "scaling_summary.csv"), index=False)
    print(table.to_string(index=False, float_format=lambda v: f"{v:.4f}"))


def by_size(df, outdir):
    d = df[df.experiment == "size"]
    if d.empty:
        return
    s = summarise(d, ["method", "P", "K", "N"])
    fig, ax = plt.subplots(figsize=(6, 4.2))
    for (method, P, K), m in s.groupby(["method", "P", "K"]):
        ax.plot(m.N, m.mult / K, marker="o", label=f"{LABELS.get(method, method)}, P={P}")
    ax.set_xscale("log", base=2)
    ax.set_yscale("log")
    ax.set_xlabel("matrix size N")
    ax.set_ylabel("time per multiplication, s")
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "matrix_size.png"), dpi=130)
    plt.close(fig)
    s.to_csv(os.path.join(outdir, "size_summary.csv"), index=False)
    print("saved", os.path.join(outdir, "matrix_size.png"))


def amortisation(df, outdir):
    d = df[df.experiment == "amortisation"]
    if d.empty:
        return
    s = summarise(d, ["method", "P", "N", "K"])
    s["setup_share"] = s.setup / s.total
    fig, ax = plt.subplots(figsize=(6, 4.2))
    for (method, P, N), m in s.groupby(["method", "P", "N"]):
        ax.plot(m.K, 100 * m.setup_share, marker="o", label=f"{LABELS.get(method, method)}, P={P}, N={N}")
    ax.set_xscale("log")
    ax.set_xlabel("K (number of multiplications)")
    ax.set_ylabel("distribution share of total time, %")
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "amortisation.png"), dpi=130)
    plt.close(fig)
    s.to_csv(os.path.join(outdir, "amortisation_summary.csv"), index=False)
    print("saved", os.path.join(outdir, "amortisation.png"))


def bonus(path, outdir):
    if not os.path.exists(path):
        return
    d = pd.read_csv(path)
    s = d.groupby(["method", "P", "n"]).seconds_per_call.median().reset_index()
    fig, ax = plt.subplots(figsize=(6.5, 4.2))
    for (method, P), m in s.groupby(["method", "P"]):
        ax.plot(m.n, m.seconds_per_call * 1e6, marker="o",
                linestyle="-" if method == "Allreduce" else "--", label=f"{method}, P={P}")
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("message size, float64 elements")
    ax.set_ylabel("time per call, microseconds")
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "bonus_allreduce.png"), dpi=130)
    plt.close(fig)
    piv = s.pivot_table(index=["P", "n"], columns="method", values="seconds_per_call") * 1e6
    piv["Reduce+Bcast / Allreduce"] = piv["Reduce+Bcast"] / piv["Allreduce"]
    piv.to_csv(os.path.join(outdir, "bonus_allreduce_summary.csv"))
    print(piv.to_string(float_format=lambda v: f"{v:.2f}"))
    print("saved", os.path.join(outdir, "bonus_allreduce.png"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="results.csv")
    parser.add_argument("--bonus-csv", default="bonus_allreduce.csv")
    parser.add_argument("--out", default="plots")
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    if os.path.exists(args.csv):
        df = pd.read_csv(args.csv)
        strong_scaling(df, args.out)
        by_size(df, args.out)
        amortisation(df, args.out)
    bonus(args.bonus_csv, args.out)
