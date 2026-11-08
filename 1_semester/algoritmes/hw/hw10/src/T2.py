from pathlib import Path

from de import student_de
from nb import helpers

h = helpers()
plt = h["plt"]
OUT = Path(__file__).resolve().parent / "t2"
OUT.mkdir(exist_ok=True)
FIT_BUDGET = 16000

datasets = h["t2_datasets"]()
h["plot_t2_gallery"](datasets).savefig(OUT / "T2_datasets.png", dpi=140)
plt.close("all")
runs, fits = {}, {}
for index, data in enumerate(datasets):
    fits[index] = {}
    print(f"{data['name']}, outliers {data['outlier_fraction']:.0%}, truth {data['truth']}")
    print("  truth metrics", {k: round(v, 5) for k, v in h["fit_metrics"](data, data["truth"]).items()})
    for objective in ("MAE", "MedAE"):
        run = h["run_fitting"](student_de, data, objective, budget=FIT_BUDGET)
        runs[index, objective] = run
        fits[index][objective] = run.best
        run.save(OUT / f"T2_{index}_{objective}")
        metrics = h["fit_metrics"](data, run.best)
        print(f"  {objective}: evals {run.evaluations}, {run.seconds:.3f}s, best {[round(v, 3) for v in run.best]}")
        print("    metrics", {k: round(v, 5) for k, v in metrics.items()})
        print("    best at cutoffs", {c: round(run.history[c - 1]["best_fitness"], 5) for c in (1000, 2000, 4000, 8000, 16000)})
h["plot_t2_gallery"](datasets, fits).savefig(OUT / "T2_fits.png", dpi=140)
plt.close("all")
for objective in ("MAE", "MedAE"):
    h["plot_progress"]([runs[3, objective]], f"T2: contaminated quintic, {objective}").savefig(
        OUT / f"T2_quintic_outliers_{objective}_progress.png", dpi=140)
    plt.close("all")
