import json
from pathlib import Path
from statistics import median

from de import student_de, student_jde
from nb import helpers

h = helpers()
plt = h["plt"]
OUT = Path(__file__).resolve().parent / "b1"
OUT.mkdir(exist_ok=True)
HARD_BUDGET = 16000
TARGET = 0.08
CUTS = (2000, 4000, 6000, 8000, 10000, 12000, 16000)

data = h["wave_data"](2)
methods = {"baseline DE, CR=0.7": (student_de, 0.7), "control DE, CR=1.0": (student_de, 1.0),
           "jDE, start CR=0.7": (student_jde, 0.7)}
runs, rows = {}, []
for name, (solver, cr) in methods.items():
    for seed in (0, 1, 2):
        run = h["run_fitting"](solver, data, "MAE", seed=seed, CR=cr, budget=HARD_BUDGET, label=f"{name}, seed {seed}")
        runs[name, seed] = run
        tag = name.split(",")[0].split()[0] + f"_CR{round(cr * 10):02d}"
        run.save(OUT / f"B1_{tag}_{seed}", target=TARGET)
        s = run.summary(TARGET)
        metrics = h["fit_metrics"](data, run.best)
        row = {"method": name, "seed": seed, "evaluations": run.evaluations, "seconds": run.seconds,
               "final": run.best_fitness, "held_out_MAE": metrics["held_out_MAE"],
               "target_evaluation": s["target_evaluation"],
               "cutoffs": {c: run.history[c - 1]["best_fitness"] for c in CUTS}}
        trace = run.settings.get("adaptation")
        if trace:
            row["adaptation"] = [t for t in trace if t["evaluation"] % 2000 < 40 or t is trace[-1]]
        rows.append(row)
        print(f"{name} seed {seed}: final {run.best_fitness:.5f}, held-out {metrics['held_out_MAE']:.4f}, "
              f"to {TARGET}: {s['target_evaluation']}, {run.seconds:.2f}s")
        print("   cutoffs", {c: round(v, 4) for c, v in row["cutoffs"].items()})
        if trace:
            print("   adaptation", [(t["evaluation"], round(t["mean_F"], 2), round(t["mean_CR"], 2)) for t in row["adaptation"]])
(OUT / "B1_summary.json").write_text(json.dumps(rows, indent=2) + "\n")

print("\nmedians")
for name in methods:
    group = [r for r in rows if r["method"] == name]
    hits = [r["target_evaluation"] for r in group if r["target_evaluation"]]
    print(f"{name}: to target {hits} median {median(hits) if len(hits) == 3 else '-'}, "
          f"at 8000 {median(r['cutoffs'][8000] for r in group):.4f}, final {median(r['final'] for r in group):.5f}")

fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), layout="constrained")
colours = plt.rcParams["axes.prop_cycle"].by_key()["color"]
for colour, name in zip(colours, methods):
    for seed in (0, 1, 2):
        run = runs[name, seed]
        for ax, axis in zip(axes, ("evaluation", "seconds")):
            ax.plot([r[axis] for r in run.history], [r["best_fitness"] for r in run.history], color=colour,
                    linestyle=["-", "--", ":"][seed], label=f"{name}, seed {seed}" if axis == "seconds" else None)
for ax, label in zip(axes, ("Fitness evaluations", "Search time (seconds)")):
    ax.axhline(TARGET, color="grey", lw=0.8)
    ax.set(xlabel=label, ylabel="Best MAE (log scale)", yscale="log")
    ax.grid(alpha=0.2)
axes[1].legend(fontsize=7)
fig.suptitle("B1: two-wave case, equal budget 16,000")
fig.savefig(OUT / "B1_progress.png", dpi=140)
plt.close(fig)

fig, axes = plt.subplots(1, 2, figsize=(12, 4), layout="constrained")
for seed in (0, 1, 2):
    trace = runs["jDE, start CR=0.7", seed].settings["adaptation"]
    for ax, key in zip(axes, ("mean_F", "mean_CR")):
        ax.plot([t["evaluation"] for t in trace], [t[key] for t in trace], linestyle=["-", "--", ":"][seed], label=f"seed {seed}")
for ax, key in zip(axes, ("Population mean F", "Population mean CR")):
    ax.set(xlabel="Fitness evaluations", ylabel=key, ylim=(0, 1.05))
    ax.grid(alpha=0.2)
axes[0].legend()
fig.suptitle("B1: jDE parameter adaptation")
fig.savefig(OUT / "B1_adaptation.png", dpi=140)
plt.close(fig)
fits = {f"jDE seed {s}": runs["jDE, start CR=0.7", s].best for s in (0, 1, 2)}
h["plot_fit"](data, fits).figure.savefig(OUT / "B1_jde_fits.png", dpi=140)
plt.close("all")
fits = {f"CR=1.0 seed {s}": runs["control DE, CR=1.0", s].best for s in (0, 1, 2)}
h["plot_fit"](data, fits).figure.savefig(OUT / "B1_control_fits.png", dpi=140)
