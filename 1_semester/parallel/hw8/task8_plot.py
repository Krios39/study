import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

LABELS = {"sequential": "Sequential C++", "omp_for": "OpenMP (parallel for)",
          "omp_tasks": "OpenMP (tasks, from 2.3.2)", "opencl": "OpenCL (GPU, incl. transfers)",
          "opencl_kernel": "OpenCL (GPU, kernel only)"}


def plot_8_1(csv="results_8_1.csv", outdir="plots"):
    d = pd.read_csv(csv)
    s = d.groupby(["impl", "N"]).seconds.median().unstack(0)
    k = d[d.impl == "opencl"].groupby("N").kernel_seconds.median()
    s["opencl_kernel"] = k
    fig, ax = plt.subplots(figsize=(7, 4.5))
    for impl in ["sequential", "omp_for", "omp_tasks", "opencl", "opencl_kernel"]:
        if impl in s:
            ax.plot(s.index, s[impl], marker="o", linestyle="--" if impl == "opencl_kernel" else "-",
                    label=LABELS[impl])
    ax.set_xscale("log", base=2)
    ax.set_yscale("log")
    ax.set_xticks(s.index)
    ax.set_xticklabels([str(n) for n in s.index])
    ax.set_xlabel("matrix size N (N x N)")
    ax.set_ylabel("execution time, s (median)")
    ax.set_title("Exercise 8.1: matrix multiplication")
    ax.grid(alpha=0.3, which="both")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "ex8_1_times.png"), dpi=130)
    plt.close(fig)

    table = s.copy()
    for impl in [c for c in s.columns if c != "sequential"]:
        table[f"speedup_{impl}"] = s["sequential"] / s[impl]
    table["gflops_opencl_kernel"] = 2 * table.index.values.astype(float) ** 3 / s["opencl_kernel"] / 1e9
    table.to_csv(os.path.join(outdir, "ex8_1_summary.csv"))
    print(table.to_string(float_format=lambda v: f"{v:.4f}"))


def plot_8_2(csv="results_8_2.csv", outdir="plots"):
    d = pd.read_csv(csv)
    s = d.groupby(["kernel", "N", "local_item_size"])[["seconds", "kernel_seconds"]].median().reset_index()
    fig, ax = plt.subplots(figsize=(7, 4.5))
    Ns = sorted(s.N.unique())
    x = np.arange(len(Ns))
    w = 0.2
    for i, (kernel, col, hatch) in enumerate([("kernel_A", "seconds", ""), ("kernel_A", "kernel_seconds", "//"),
                                              ("kernel_B", "seconds", ""), ("kernel_B", "kernel_seconds", "//")]):
        m = s[s.kernel == kernel].set_index("N").reindex(Ns)
        kind = "total" if col == "seconds" else "kernel only"
        bars = ax.bar(x + (i - 1.5) * w, m[col], w, hatch=hatch,
                      color="#d62728" if kernel == "kernel_A" else "#1f77b4", alpha=1.0 if col == "seconds" else 0.6,
                      label=f"{kernel}, {kind}")
        if col == "seconds":
            for b, L in zip(bars, m.local_item_size):
                ax.annotate(f"L={L}", (b.get_x() + b.get_width() / 2, b.get_height()), ha="center", va="bottom",
                            fontsize=7)
    ax.set_yscale("log")
    ax.set_xticks(x)
    ax.set_xticklabels([f"N={n}" for n in Ns])
    ax.set_ylabel("time, s (median)")
    ax.set_title("Exercise 8.2: kernel_A (L=2) vs kernel_B (L=8/32/64)")
    ax.grid(alpha=0.3, axis="y", which="both")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "ex8_2_kernels.png"), dpi=130)
    plt.close(fig)
    s.to_csv(os.path.join(outdir, "ex8_2_summary.csv"), index=False)
    print(s.to_string(index=False, float_format=lambda v: f"{v:.4f}"))


def main():
    os.makedirs("plots", exist_ok=True)
    if os.path.exists("results_8_1.csv"):
        plot_8_1()
    if os.path.exists("results_8_2.csv"):
        plot_8_2()
