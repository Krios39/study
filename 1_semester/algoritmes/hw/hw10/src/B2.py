import json
import sys
from pathlib import Path
from statistics import median

import numpy as np
import scipy
from scipy.optimize import differential_evolution

import ga
from de import student_de
from nb import helpers, image_helpers

CASE = sys.argv[1] if len(sys.argv) > 1 else "t4"
OUT = Path(__file__).resolve().parent / "b2"
OUT.mkdir(exist_ok=True)
SEEDS = (0, 1, 2)

MATCHED = {"strategy": "rand1bin", "mutation": 0.8, "recombination": 0.7, "updating": "deferred", "tol": 0, "atol": 0}
DEFAULTS = {}
NO_STOP = {"tol": 0, "atol": 0}


def scipy_solver(options):
    def solver(run, initial, *, seed=0, **_):
        bounds = run.bounds
        size = len(initial)
        generations = (run.remaining - size) // size

        def fitness(x):
            return run([min(max(float(v), low), high) for v, (low, high) in zip(x, bounds)])

        result = differential_evolution(fitness, bounds, init=np.array(initial), maxiter=generations, polish=False,
                                        rng=seed, **options)
        run.settings.update({"package": f"scipy {scipy.__version__}", "scipy_options": {"polish": False, **options},
                             "maxiter": generations, "scipy_nit": int(result.nit), "scipy_nfev": int(result.nfev),
                             "scipy_message": str(result.message)})
    return solver


METHODS = {"own": None, "SciPy matched": scipy_solver(MATCHED), "SciPy defaults": scipy_solver(DEFAULTS),
           "SciPy defaults no stop": scipy_solver(NO_STOP)}

if CASE == "t4":
    h = helpers()
    data = h["wave_data"](2)
    METHODS["own"] = student_de
    budget, objective, cuts = 16000, "MAE", (2000, 4000, 8000, 12000, 16000)
    METHODS_LABEL = {"own": "own DE (rand/1, CR=0.7)"}

    def execute(name, seed):
        return h["run_fitting"](METHODS[name], data, objective, seed=seed, CR=0.7, budget=budget,
                                label=f"{METHODS_LABEL.get(name, name)}, seed {seed}")

    def quality(run):
        return h["fit_metrics"](data, run.best)["held_out_MAE"]
else:
    h = image_helpers()
    original = h["load_rgb"](next(Path(__file__).resolve().parent.parent.glob("Konrad-M*Venice.jpg")))
    target = h["prepare_target"](original, max_side=128)
    METHODS["own"] = ga.student_ga
    budget, objective, cuts = 3000, "RGB MSE", (500, 1000, 2000, 3000)
    METHODS_LABEL = {"own": "own GA"}

    def execute(name, seed):
        run = h["run_image"](METHODS[name], target, seed=seed, circles=50, population=20, budget=budget)
        run.label = f"{METHODS_LABEL.get(name, name)}, seed {seed}"
        return run

    def quality(run):
        return None

plt = h["plt"]
runs, rows = {}, []
for seed in SEEDS:
    for name in METHODS:
        run = execute(name, seed)
        runs[name, seed] = run
        run.save(OUT / f"B2_{CASE}_{name.replace(' ', '_')}_{seed}")
        row = {"case": CASE, "method": name, "seed": seed, "evaluations": run.evaluations, "seconds": run.seconds,
               "final": run.best_fitness, "held_out_MAE": quality(run),
               "cutoffs": {c: run.history[c - 1]["best_fitness"] for c in cuts if c <= run.evaluations},
               "scipy": {k: v for k, v in run.settings.items() if k.startswith("scipy") or k in ("package", "maxiter")}}
        rows.append(row)
        print(f"{name:15} seed {seed}: evals {run.evaluations}, {run.seconds:.2f}s, final {run.best_fitness:.5f}, "
              f"held-out {row['held_out_MAE']}, cutoffs {[round(v, 4) for v in row['cutoffs'].values()]} {row['scipy']}")
(OUT / f"B2_{CASE}_summary.json").write_text(json.dumps(rows, indent=2) + "\n")

print("\nmedians")
for name in METHODS:
    group = [r for r in rows if r["method"] == name]
    print(f"{name:15} final {median(r['final'] for r in group):.5f} [{min(r['final'] for r in group):.5f}, "
          f"{max(r['final'] for r in group):.5f}], seconds {median(r['seconds'] for r in group):.2f}, "
          f"ms per evaluation {1000 * median(r['seconds'] / r['evaluations'] for r in group):.3f}")

fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), layout="constrained")
colours = plt.rcParams["axes.prop_cycle"].by_key()["color"]
for colour, name in zip(colours, METHODS):
    for seed in SEEDS:
        run = runs[name, seed]
        for ax, axis in zip(axes, ("evaluation", "seconds")):
            ax.plot([r[axis] for r in run.history], [r["best_fitness"] for r in run.history], color=colour,
                    linestyle=["-", "--", ":"][seed], label=f"{METHODS_LABEL.get(name, name)}, seed {seed}" if axis == "seconds" else None)
for ax, label in zip(axes, ("Fitness evaluations", "Search time (seconds)")):
    ax.set(xlabel=label, ylabel=f"Best {objective} (log scale)", yscale="log")
    ax.grid(alpha=0.2)
axes[1].legend(fontsize=7)
fig.suptitle(f"B2 ({CASE.upper()}): own method vs SciPy differential_evolution, budget {budget:,}")
fig.savefig(OUT / f"B2_{CASE}_progress.png", dpi=140)
plt.close(fig)

if CASE == "t4":
    for name in ("SciPy matched", "SciPy defaults", "SciPy defaults no stop"):
        fits = {f"seed {s}": runs[name, s].best for s in SEEDS}
        h["plot_fit"](data, fits).figure.savefig(OUT / f"B2_t4_{name.replace(' ', '_')}_fits.png", dpi=140)
        plt.close("all")
else:
    images = {f"{METHODS_LABEL.get(name, name)}, seed {s}: MSE {runs[name, s].best_fitness:.4f}":
              h["render_circles"](runs[name, s].best, target.shape[:2]) for name in METHODS for s in SEEDS}
    h["show_images"](images, "B2 (T5): final best images, rows = methods", columns=3).savefig(
        OUT / "B2_t5_final_images.png", dpi=140)
    plt.close("all")
