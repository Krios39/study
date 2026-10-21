import argparse
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

LABELS = {"blocking": "blocking (Sendrecv)", "nonblocking": "nonblocking (Isend/Irecv)",
          "circulate_A": "circulate A (bonus A)"}


def summarise(df):
    g = df.groupby(["method", "N", "P"])
    s = g.time.median().rename("median").to_frame()
    s["min"] = g.time.min()
    s["max"] = g.time.max()
    s["setup"] = g.setup.median()
    s["runs"] = g.size()
    s = s.reset_index()
    t1 = s[s.P == 1].set_index(["method", "N"])["median"]
    s["speedup"] = [t1.get((m, n), np.nan) / t for m, n, t in zip(s.method, s.N, s["median"])]
    s["efficiency"] = s.speedup / s.P
    s["gflops"] = 2 * s.N.astype(float) ** 3 / s["median"] / 1e9
    return s


def plot_scaling(s, outdir):
    for N, sub in s.groupby("N"):
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.2))
        ps = np.array(sorted(sub.P.unique()))
        for method, m in sub.groupby("method"):
            m = m.sort_values("P")
            ax1.errorbar(m.P, m["median"], yerr=[m["median"] - m["min"], m["max"] - m["median"]],
                         marker="o", capsize=3, label=LABELS.get(method, method))
            ax2.plot(m.P, m.speedup, marker="o", label=LABELS.get(method, method))
        ax2.plot(ps, ps, "k--", label="ideal S(P) = P")
        for ax in (ax1, ax2):
            ax.set_xscale("log", base=2)
            ax.set_xticks(ps)
            ax.set_xticklabels([str(p) for p in ps])
            ax.set_xlabel("processes P")
            ax.grid(alpha=0.3)
        ax1.set_ylabel("time, s (median, bars = min..max)")
        ax2.set_ylabel("speedup T(1)/T(P)")
        ax1.set_title(f"Execution time, N={N}")
        ax2.set_title(f"Speedup, N={N}")
        ax1.legend(fontsize=8)
        ax2.legend(fontsize=8)
        fig.tight_layout()
        path = os.path.join(outdir, f"scaling_N{N}.png")
        fig.savefig(path, dpi=130)
        plt.close(fig)
        print("saved", path)


def plot_blocking_vs_nonblocking(s, outdir):
    d = s[s.method.isin(["blocking", "nonblocking"])]
    if d.empty:
        return
    Ns = sorted(d.N.unique())
    fig, axes = plt.subplots(1, len(Ns), figsize=(4.2 * len(Ns), 3.8), squeeze=False)
    for ax, N in zip(axes[0], Ns):
        sub = d[d.N == N]
        ps = sorted(sub.P.unique())
        x = np.arange(len(ps))
        for i, method in enumerate(["blocking", "nonblocking"]):
            m = sub[sub.method == method].set_index("P").reindex(ps)
            ax.bar(x + (i - 0.5) * 0.38, m["median"], 0.38,
                   yerr=[m["median"] - m["min"], m["max"] - m["median"]], capsize=3, label=LABELS[method])
        ax.set_xticks(x)
        ax.set_xticklabels([f"P={p}" for p in ps])
        ax.set_title(f"N={N}")
        ax.set_ylabel("time, s")
        ax.grid(alpha=0.3, axis="y")
    axes[0][0].legend(fontsize=8)
    fig.tight_layout()
    path = os.path.join(outdir, "blocking_vs_nonblocking.png")
    fig.savefig(path, dpi=130)
    plt.close(fig)
    print("saved", path)


def compare_machines(laptop_csv="results.csv", server_csv="results_server.csv", outdir="plots_compare"):
    os.makedirs(outdir, exist_ok=True)
    data = {"laptop": summarise(pd.read_csv(laptop_csv)), "server": summarise(pd.read_csv(server_csv))}
    Ns = sorted(set(data["laptop"].N) & set(data["server"].N))
    colors = {"laptop": "#d62728", "server": "#1f77b4"}
    styles = {"blocking": "-", "nonblocking": "--"}
    fig, axes = plt.subplots(1, len(Ns), figsize=(4.6 * len(Ns), 4), squeeze=False)
    for ax, N in zip(axes[0], Ns):
        pmax = 1
        for machine, s in data.items():
            for method, ls in styles.items():
                m = s[(s.N == N) & (s.method == method)].sort_values("P")
                ax.plot(m.P, m.speedup, ls, marker="o", color=colors[machine], label=f"{machine}, {method}")
                pmax = max(pmax, m.P.max())
        ps = [2 ** k for k in range(int(np.log2(pmax)) + 1)]
        ax.plot(ps, ps, "k:", label="ideal")
        ax.set_xscale("log", base=2)
        ax.set_yscale("log", base=2)
        ax.set_xticks(ps)
        ax.set_xticklabels([str(p) for p in ps])
        ax.set_xlabel("processes P")
        ax.set_ylabel("speedup T(1)/T(P)")
        ax.set_title(f"N={N}")
        ax.grid(alpha=0.3)
    axes[0][0].legend(fontsize=8)
    fig.tight_layout()
    path = os.path.join(outdir, "laptop_vs_server_speedup.png")
    fig.savefig(path, dpi=130)
    plt.close(fig)
    print("saved", path)

    rows = []
    for N in Ns:
        for machine, s in data.items():
            for method in styles:
                m = s[(s.N == N) & (s.method == method)].set_index("P")
                best = m["median"].idxmin()
                rows.append([N, machine, method, m.loc[1, "median"], m.loc[1, "gflops"], best,
                             m.loc[best, "median"], m.loc[best, "speedup"], m.loc[best, "gflops"]])
    table = pd.DataFrame(rows, columns=["N", "machine", "method", "T1", "gflops_P1", "best_P", "T_best",
                                        "speedup_best", "gflops_best"])
    table.to_csv(os.path.join(outdir, "laptop_vs_server.csv"), index=False)
    print(table.to_string(index=False, float_format=lambda v: f"{v:.4f}"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="results.csv")
    parser.add_argument("--out", default="plots")
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    s = summarise(pd.read_csv(args.csv))
    s.to_csv(os.path.join(args.out, "summary.csv"), index=False)
    print(s.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
    plot_scaling(s, args.out)
    plot_blocking_vs_nonblocking(s, args.out)
