import glob
import re

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

BLUE, ORANGE, GREY = "#2a78d6", "#eb6834", "#8a8a85"


def parse(path):
    text = open(path).read()
    node = re.search(r"node=(\S+)", text).group(1)
    cpu = re.search(r"Model name:\s+(.+)", text).group(1).strip()
    rows = []
    for block in re.finditer(r"((?:run \d+: Time taken: [\d.]+\n)+)rows=(\d+) cols=(\d+) partitions=(\d+) "
                             r"master=local\[(\d+)\]", text):
        runs = [float(t) for t in re.findall(r"Time taken: ([\d.]+)", block.group(1))]
        rows.append({"cores": int(block.group(5)), "rows": int(block.group(2)), "cols": int(block.group(3)),
                     "partitions": int(block.group(4)), "node": node, "cpu": cpu,
                     "run1": runs[0], "run2": runs[1], "run3": runs[2],
                     "median": sorted(runs)[1], "warm_mean": sum(runs[1:]) / 2})
    return rows


def main():
    frame = pd.DataFrame([r for p in sorted(glob.glob("cluster/sparkjob-*.out")) for r in parse(p)])
    frame = frame.sort_values(["rows", "cores"]).reset_index(drop=True)
    t1 = frame[frame.cores == 1].set_index("rows")["median"]
    frame["speedup"] = frame.apply(lambda r: t1[r.rows] / r["median"], axis=1)
    frame["efficiency"] = frame.speedup / frame.cores
    frame.to_csv("summary_12_3.csv", index=False)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.2))
    cores = sorted(frame.cores.unique())
    ax2.plot(cores, cores, color=GREY, linestyle="--", linewidth=1, label="ideal")
    for rows, color, marker in [(32000, BLUE, "o"), (128000, ORANGE, "s")]:
        part = frame[frame.rows == rows]
        ax1.plot(part.cores, part["median"], color=color, marker=marker, linewidth=2, label=f"{rows} × 1000")
        ax2.plot(part.cores, part.speedup, color=color, marker=marker, linewidth=2, label=f"{rows} × 1000")
        for c, s in zip(part.cores, part.speedup):
            ax2.annotate(f"{s:.1f}", (c, s), textcoords="offset points", xytext=(0, 7), ha="center", fontsize=9)
    for ax, ylabel, title in [(ax1, "median time, s", "Time (parallelize + map + collect)"),
                              (ax2, "speedup T1 / Tc", "Speedup vs local[1]")]:
        ax.set_xscale("log", base=2)
        ax.set_xticks(cores, [str(c) for c in cores])
        ax.set_xlabel("Spark cores, local[c]")
        ax.set_ylabel(ylabel)
        ax.set_title(title, loc="left", fontsize=11)
        ax.grid(True, color="#e6e6e3", linewidth=0.8)
        ax.spines[["top", "right"]].set_visible(False)
        ax.legend(frameon=False)
    ax2.set_yscale("log", base=2)
    ax2.set_yticks(cores, [str(c) for c in cores])
    fig.tight_layout()
    fig.savefig("speedup_12_3.png", dpi=150)

    pd.set_option("display.width", 200)
    print(frame[["rows", "cores", "node", "run1", "run2", "run3", "median", "speedup", "efficiency"]]
          .to_string(index=False, float_format=lambda v: f"{v:.3f}"))


if __name__ == "__main__":
    main()
