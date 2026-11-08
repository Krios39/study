import json
from pathlib import Path
from statistics import median

from de import student_de
from nb import helpers

h = helpers()
plt = h["plt"]
OUT = Path(__file__).resolve().parent / "t3"
OUT.mkdir(exist_ok=True)
FIT_BUDGET = 16000
TARGET = 0.10

data = h["t2_datasets"]()[3]
runs = []
for index, config in enumerate(h["t3_configurations"](extra="population", budget=FIT_BUDGET)):
    label = f"NP={config['population']}, CR={config['CR']}, s={config['seed']}"
    run = h["run_fitting"](student_de, data, "MedAE", label=label, **config)
    runs.append(run)
    run.save(OUT / f"T3_{index}", target=TARGET)

print("All runs")
h["experiment_table"](runs, target=TARGET)

groups = {}
for run in runs:
    groups.setdefault((run.settings["population"], run.settings["CR"]), []).append(run)
rows = []
print("\nGroups: final MedAE median [min, max]; target hits; evaluations and seconds to target per seed")
for (population, cr), trials in groups.items():
    finals = [r.best_fitness for r in trials]
    hits = [r.summary(TARGET) for r in trials]
    early = {c: median(r.history[c - 1]["best_fitness"] for r in trials) for c in (500, 1000, 2000, 4000)}
    row = {"population": population, "CR": cr, "median": median(finals), "min": min(finals), "max": max(finals),
           "hits": sum(s["reached"] for s in hits),
           "target_evaluation": [s["target_evaluation"] if s["reached"] else "not reached" for s in hits],
           "target_seconds": [round(s["target_seconds"], 3) if s["reached"] else "not reached" for s in hits],
           "median_at": early, "seconds": [round(r.seconds, 3) for r in trials],
           "held_out_MAE": [h["fit_metrics"](data, r.best)["held_out_MAE"] for r in trials]}
    rows.append(row)
    print(f"NP={population:<3} CR={cr:<4} median {row['median']:.5f} [{row['min']:.5f}, {row['max']:.5f}] "
          f"hits {row['hits']}/3 evals {row['target_evaluation']} sec {row['target_seconds']}")
    print(f"    median best at 500/1000/2000/4000: {[round(v, 4) for v in early.values()]}; "
          f"held-out MAE {[round(v, 4) for v in row['held_out_MAE']]}; run seconds {row['seconds']}")
(OUT / "T3_summary.json").write_text(json.dumps(rows, indent=2) + "\n")


def curves(selected, title, name):
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), layout="constrained")
    colours = plt.rcParams["axes.prop_cycle"].by_key()["color"]
    for colour, key in zip(colours, selected):
        for seed, run in enumerate(groups[key]):
            for ax, axis in zip(axes, ("evaluation", "seconds")):
                ax.plot([row[axis] for row in run.history], [row["best_fitness"] for row in run.history],
                        color=colour, alpha=0.85, linestyle=["-", "--", ":"][seed],
                        label=f"NP={key[0]}, CR={key[1]}, seed {seed}" if axis == "seconds" else None)
    for ax, label in zip(axes, ("Fitness evaluations", "Search time (seconds)")):
        ax.axhline(TARGET, color="grey", lw=0.8)
        ax.set(xlabel=label, ylabel="Best MedAE (log scale)", yscale="log")
        ax.grid(alpha=0.2)
    axes[1].legend(fontsize=7, ncol=2)
    fig.suptitle(title)
    fig.savefig(OUT / name, dpi=140)
    plt.close(fig)


curves([(40, 1.0), (40, 0.7), (40, 0.3), (40, 0.0)], "T3: crossover rate, all seeds", "T3_crossover_progress.png")
curves([(20, 0.7), (40, 0.7), (80, 0.7)], "T3: population at CR=0.7, all seeds", "T3_population_progress.png")
fits = {f"CR={cr}, seed 0": groups[40, cr][0].best for cr in (1.0, 0.7, 0.3, 0.0)}
h["plot_fit"](data, fits).figure.savefig(OUT / "T3_fits_seed0.png", dpi=140)
