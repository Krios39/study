import json
import sys
from pathlib import Path

import ga
from nb import image_helpers

h = image_helpers()
plt, Image, np = h["plt"], h["Image"], h["np"]
OUT = Path(__file__).resolve().parent / "t5"
OUT.mkdir(exist_ok=True)
IMAGE_PATH = next(Path(__file__).resolve().parent.parent.glob("Konrad-M*Venice.jpg"))
MAX_SIDE = 128
IMAGE_BUDGET = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
CIRCLES = int(sys.argv[2]) if len(sys.argv) > 2 else 50
SEEDS = (0, 1, 2) if len(sys.argv) <= 3 else tuple(int(s) for s in sys.argv[3].split(","))
PARTICIPANT = "Ruslan Nechshadimov"
GA_SETTINGS = {"selection": "binary tournament", "crossover": "uniform, whole circles, p=0.5",
               "mutation": f"per value p={ga.MUTATION_RATE}, gaussian sigma={ga.MUTATION_SCALE}*range, clipped",
               "elitism": ga.ELITE}

original = h["load_rgb"](IMAGE_PATH)
target = h["prepare_target"](original, max_side=MAX_SIDE)
height, width = target.shape[:2]
print("original (w, h)", (original.shape[1], original.shape[0]), "working (w, h)", (width, height),
      "sha256", h["image_digest"](target))
h["show_images"]({"Original": original, f"Working target {width}x{height}": target},
                 "T5 target", columns=2).savefig(OUT / "T5_target.png", dpi=140)
plt.close("all")

runs = []
for seed in SEEDS:
    run = h["run_image"](ga.student_ga, target, seed=seed, circles=CIRCLES, population=20, budget=IMAGE_BUDGET)
    run.settings.update(GA_SETTINGS)
    runs.append(run)
    initial = run.snapshots[1] if len(run.snapshots) > 1 else run.snapshots[0]
    print(f"seed {seed}: evals {run.evaluations}, {run.seconds:.2f}s, initial best {initial['fitness']:.5f} "
          f"(eval {initial['evaluation']}), final {run.best_fitness:.5f}")
    print("  best at cutoffs", {c: round(run.history[c - 1]["best_fitness"], 5)
                                for c in (20, 500, 1000, 2000, 3000, 6000, 12000) if c <= run.evaluations})
    h["plot_image_evolution"](run, target).savefig(OUT / f"T5_c{CIRCLES}_b{IMAGE_BUDGET}_seed{seed}_evolution.png", dpi=140)
    plt.close("all")
    stem = OUT / (f"T5_{width}x{height}_{run.settings['target_sha256'][:12]}_circles_{CIRCLES}"
                  f"_seed_{seed}_budget_{IMAGE_BUDGET}")
    h["export_image_run"](run, target, PARTICIPANT, stem)
    print("  verified MSE", h["verify_image_export"](stem, target))
    Image.fromarray(h["render_circles"](run.best, original.shape[:2])).save(
        OUT / f"T5_c{CIRCLES}_b{IMAGE_BUDGET}_seed{seed}_full_resolution.png")
h["plot_progress"](runs, f"T5: {CIRCLES} circles, budget {IMAGE_BUDGET}").savefig(
    OUT / f"T5_c{CIRCLES}_b{IMAGE_BUDGET}_progress.png", dpi=140)
plt.close("all")
h["experiment_table"](runs)
