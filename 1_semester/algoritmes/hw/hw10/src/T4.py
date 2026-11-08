import json
from pathlib import Path

from de import student_de
from nb import helpers

h = helpers()
plt = h["plt"]
OUT = Path(__file__).resolve().parent / "t4"
OUT.mkdir(exist_ok=True)
HARD_BUDGET = 16000

datasets = [h["wave_data"](1), h["wave_data"](2)]
fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), layout="constrained")
for data, ax in zip(datasets, axes):
    h["plot_fit"](data, ax=ax)
fig.savefig(OUT / "T4_wave_data.png", dpi=140)
plt.close("all")

summary = []
for data in datasets:
    print(data["name"], "truth", [round(v, 4) for v in data["truth"]])
    print("  truth metrics", {k: round(v, 5) for k, v in h["fit_metrics"](data, data["truth"]).items()})
    fits, case_runs = {}, []
    for seed in (0, 1, 2):
        run = h["run_fitting"](student_de, data, "MAE", seed=seed, CR=0.7, budget=HARD_BUDGET,
                               label=f"{data['name']}, seed {seed}")
        case_runs.append(run)
        fits[f"Seed {seed}"] = run.best
        run.save(OUT / f"T4_{data['name']}_{seed}")
        metrics = h["fit_metrics"](data, run.best)
        cutoffs = {c: run.history[c - 1]["best_fitness"] for c in (1000, 2000, 4000, 8000, 16000)}
        summary.append({"case": data["name"], "seed": seed, "evaluations": run.evaluations,
                        "seconds": run.seconds, "best": list(run.best), "metrics": metrics, "cutoffs": cutoffs})
        print(f"  seed {seed}: evals {run.evaluations}, {run.seconds:.3f}s, best {[round(v, 4) for v in run.best]}")
        print("    metrics", {k: round(v, 5) for k, v in metrics.items()})
        print("    best at cutoffs", {c: round(v, 5) for c, v in cutoffs.items()})
    h["plot_fit"](data, fits).figure.savefig(OUT / f"T4_{data['name']}_fits.png", dpi=140)
    plt.close("all")
    h["plot_progress"](case_runs, f"T4: {data['name']}").savefig(OUT / f"T4_{data['name']}_progress.png", dpi=140)
    plt.close("all")
(OUT / "T4_summary.json").write_text(json.dumps(summary, indent=2) + "\n")

two_wave = datasets[1]
middle = {}
for seed in (0, 1, 2):
    snapshots = json.loads((OUT / f"T4_two-wave_{seed}.json").read_text())["snapshots"]
    snap = next(s for s in snapshots if s["evaluation"] == 4000)
    middle[f"Seed {seed} at 4,000 (MAE {snap['fitness']:.3f})"] = snap["best"]
h["plot_fit"](two_wave, middle).figure.savefig(OUT / "T4_two-wave_at_4000.png", dpi=140)
plt.close("all")
