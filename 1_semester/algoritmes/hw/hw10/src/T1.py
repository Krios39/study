from pathlib import Path

from de import student_de
from nb import helpers

h = helpers()
plt = h["plt"]
OUT = Path(__file__).resolve().parent / "t1"
OUT.mkdir(exist_ok=True)
FIT_BUDGET = 8000

line = h["polynomial_data"]("line")
runs = {}
for objective in ("MAE", "MedAE"):
    run = h["run_fitting"](student_de, line, objective, budget=FIT_BUDGET)
    runs[objective] = run
    run.save(OUT / f"T1_{objective}")
    print(objective, "evaluations", run.evaluations, "seconds", round(run.seconds, 3),
          "best", run.best, "fitness", run.best_fitness)
    print("  metrics", h["fit_metrics"](line, run.best))
    print("  best at cutoffs", {c: run.history[c - 1]["best_fitness"] for c in (40, 200, 400, 1000, 2000, 4000, 8000)})
    h["plot_progress"]([run], f"T1: {objective}").savefig(OUT / f"T1_{objective}_progress.png", dpi=140)
    plt.close("all")

fits = {name: run.best for name, run in runs.items()}
h["plot_fit"](line, fits).figure.savefig(OUT / "T1_fits.png", dpi=140)
h["plot_landscapes"](line, fits).savefig(OUT / "T1_landscapes.png", dpi=140)
h["plot_landscapes"](line, fits, contours=True).savefig(OUT / "T1_landscapes_contours.png", dpi=140)
print("truth", line["truth"], "truth metrics", h["fit_metrics"](line, line["truth"]))
