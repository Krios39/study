import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

import ga
from de import student_de
from nb import helpers, image_helpers

SRC = Path(__file__).resolve().parent
OUT = SRC / "anim"
OUT.mkdir(exist_ok=True)
h = helpers()
hi = image_helpers()
plt = h["plt"]
PI = np.pi


class Recorder:
    def __init__(self, run):
        self.run, self.bounds, self.log = run, run.bounds, []

    @property
    def remaining(self):
        return self.run.remaining

    @property
    def settings(self):
        return self.run.settings

    def snapshot(self):
        self.run.snapshot()

    def __call__(self, candidate):
        score = self.run(candidate)
        self.log.append((list(candidate), score))
        return score


def recording(solver, logs):
    def wrapped(run, initial, **options):
        recorder = Recorder(run)
        logs.append(recorder.log)
        solver(recorder, initial, **options)
    return wrapped


def frame(fig, dpi=72):
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=dpi)
    plt.close(fig)
    buffer.seek(0)
    return Image.open(buffer).convert("RGB")


def save_gif(frames, name, duration=120, hold=1500):
    palette = [f.convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for f in frames]
    durations = [duration] * (len(frames) - 1) + [hold]
    palette[0].save(OUT / name, save_all=True, append_images=palette[1:], duration=durations, loop=0, optimize=True)
    print(name, len(frames), "frames", (OUT / name).stat().st_size // 1024, "KB")


def at(snapshots, evaluation):
    return [s for s in snapshots if s["evaluation"] <= evaluation][-1]


def snapshots(path):
    return json.loads(Path(path).with_suffix(".json").read_text())["snapshots"]


def t1():
    line = h["polynomial_data"]("line")
    histories = {}
    for objective in ("MAE", "MedAE"):
        logs = []
        run = h["run_fitting"](recording(student_de, logs), line, objective, budget=8000)
        log = logs[0]
        size = 40
        members = [c for c, _ in log[:size]]
        scores = [s for _, s in log[:size]]
        generations = [[m[:] for m in members]]
        for start in range(size, len(log), size):
            for target, (candidate, score) in enumerate(log[start:start + size]):
                if score <= scores[target]:
                    members[target], scores[target] = candidate, score
            generations.append([m[:] for m in members])
        histories[objective] = (generations, run.best)
        print(objective, "replayed best", min(scores), "logged best", run.best_fitness)
    b, a = np.meshgrid(*(np.linspace(low, high, 121) for low, high in line["bounds"]))
    zb, za = np.meshgrid(np.linspace(0.3, 0.75, 121), np.linspace(1.25, 1.75, 121))
    residual = lambda bb, aa: np.abs(line["y"] - bb[..., None] - aa[..., None] * line["x"])
    surfaces = {o: [(np.mean if o == "MAE" else np.median)(residual(*grid), axis=-1) for grid in ((b, a), (zb, za))]
                for o in ("MAE", "MedAE")}
    steps = list(range(0, 31)) + list(range(35, 101, 5)) + [150, 199]
    frames = []
    for g in steps:
        fig, axes = plt.subplots(2, 2, figsize=(10, 8.4), layout="constrained")
        for column, objective in enumerate(("MAE", "MedAE")):
            generations, best = histories[objective]
            population = np.array(generations[min(g, len(generations) - 1)])
            for row, (grid, zoom) in enumerate((((b, a), False), ((zb, za), True))):
                ax = axes[row, column]
                ax.contourf(*grid, surfaces[objective][row], levels=25, cmap="viridis")
                ax.scatter(population[:, 0], population[:, 1], s=14, color="#E34234", edgecolor="white", linewidth=0.5)
                ax.scatter([line["truth"][0]], [line["truth"][1]], marker="x", color="white", s=60)
                if zoom:
                    ax.set(xlim=(0.3, 0.75), ylim=(1.25, 1.75))
                ax.set(xlabel="Intercept b", ylabel="Slope a",
                       title=f"{objective}{' (zoom)' if zoom else ''}")
        fig.suptitle(f"T1: DE population on the training landscape, generation {g} "
                     f"({40 + 40 * g:,} evaluations); white x = original line")
        frames.append(frame(fig))
    save_gif(frames, "T1_population.gif", duration=180)


def curve_race(panels, name, title, data, step=400, last=16000, duration=160):
    frames = []
    x = np.linspace(-1, 1, 501)
    for evaluation in list(range(step, last + 1, step)):
        fig, axes = plt.subplots(1, len(panels), figsize=(5.2 * len(panels), 4.2), layout="constrained", squeeze=False)
        for ax, (label, snaps) in zip(axes[0], panels):
            snap = at(snaps, evaluation)
            best = snap["best"]
            ax.scatter(data["x"], data["y"], s=8, color="#6B8E9B", alpha=0.6)
            ax.plot(x, h["model_values"](data["truth"], x, data["model"]), color="black", lw=1.2, label="original")
            ax.plot(x, h["model_values"](best, x, data["model"]), color="#E34234", lw=1.6, label="best so far")
            freq = ", ".join(f"{best[i + 1] / PI:.2f}π (A {best[i]:.2f})" for i in range(3, len(best), 3))
            ax.set(title=f"{label}\nMAE {snap['fitness']:.3f}; waves {freq}", ylim=(-2.4, 3.4), xlabel="x")
            ax.title.set_fontsize(9)
        axes[0][0].legend(fontsize=8, loc="lower left")
        fig.suptitle(f"{title}: evaluation {evaluation:,}")
        frames.append(frame(fig))
    save_gif(frames, name, duration=duration)


def t4():
    data = h["wave_data"](2)
    panels = [(f"seed {s}", snapshots(SRC / "t4" / f"T4_two-wave_{s}")) for s in (0, 1, 2)]
    curve_race(panels, "T4_two_wave.gif", "T4 two waves, best curve of each seed", data)


def b1():
    data = h["wave_data"](2)
    panels = [("baseline DE, CR=0.7, seed 1", snapshots(SRC / "b1" / "B1_baseline_CR07_1")),
              ("control DE, CR=1.0, seed 1 (stuck)", snapshots(SRC / "b1" / "B1_control_CR10_1")),
              ("jDE, seed 1", snapshots(SRC / "b1" / "B1_jDE_CR07_1"))]
    curve_race(panels, "B1_race.gif", "B1, same seed and budget", data)


def b2_curves():
    data = h["wave_data"](2)
    panels = [("own DE, seed 2", snapshots(SRC / "b2" / "B2_t4_own_2")),
              ("SciPy defaults no stop, seed 0", snapshots(SRC / "b2" / "B2_t4_SciPy_defaults_no_stop_0")),
              ("SciPy defaults no stop, seed 2 (stuck)", snapshots(SRC / "b2" / "B2_t4_SciPy_defaults_no_stop_2"))]
    curve_race(panels, "B2_t4_race.gif", "B2 two waves", data, last=8000)


def target_image():
    original = hi["load_rgb"](next(SRC.parent.glob("Konrad-M*Venice.jpg")))
    return hi["prepare_target"](original, max_side=128)


def t5():
    target = target_image()
    logs = []
    run = hi["run_image"](recording(ga.student_ga, logs), target, seed=1, circles=50, population=20, budget=3000)
    print("T5 seed 1 best", run.best_fitness)
    log = logs[0]
    best, best_score, kept = None, float("inf"), []
    for index, (candidate, score) in enumerate(log, 1):
        if score < best_score:
            best, best_score = candidate, score
        if index == 20 or index % 100 == 0:
            kept.append((index, best, best_score))
    curve = np.minimum.accumulate([s for _, s in log])
    frames = []
    for evaluation, genome, score in kept:
        fig, axes = plt.subplots(1, 3, figsize=(13, 3.9), layout="constrained", gridspec_kw={"width_ratios": [1, 1, 1.3]})
        axes[0].imshow(target, interpolation="nearest")
        axes[0].set_title("Target 128×108")
        axes[1].imshow(hi["render_circles"](genome, target.shape[:2]), interpolation="nearest")
        axes[1].set_title(f"Best after {evaluation:,}: MSE {score:.4f}")
        for ax in axes[:2]:
            ax.axis("off")
        axes[2].plot(range(1, len(curve) + 1), curve, color="#BBBBBB")
        axes[2].plot(range(1, evaluation + 1), curve[:evaluation], color="#1F77B4")
        axes[2].set(xlabel="Fitness evaluations", ylabel="Best RGB MSE", yscale="log")
        axes[2].grid(alpha=0.2)
        fig.suptitle("T5: genetic algorithm, 50 circles, seed 1")
        frames.append(frame(fig))
    save_gif(frames, "T5_evolution.gif", duration=200)


def b2_images():
    target = target_image()
    panels = [("own GA", snapshots(SRC / "b2" / "B2_t5_own_0")),
              ("SciPy matched", snapshots(SRC / "b2" / "B2_t5_SciPy_matched_0")),
              ("SciPy defaults no stop", snapshots(SRC / "b2" / "B2_t5_SciPy_defaults_no_stop_0"))]
    frames = []
    for evaluation in [20] + list(range(200, 3001, 200)):
        fig, axes = plt.subplots(1, 4, figsize=(15, 3.6), layout="constrained")
        axes[0].imshow(target, interpolation="nearest")
        axes[0].set_title("Target")
        for ax, (label, snaps) in zip(axes[1:], panels):
            snap = at(snaps, evaluation)
            ax.imshow(hi["render_circles"](snap["best"], target.shape[:2]), interpolation="nearest")
            ax.set_title(f"{label}: MSE {snap['fitness']:.4f}")
        for ax in axes:
            ax.axis("off")
        fig.suptitle(f"B2 image, seed 0: evaluation {evaluation:,}")
        frames.append(frame(fig))
    save_gif(frames, "B2_t5_race.gif", duration=500)


JOBS = {"t1": t1, "t4": t4, "t5": t5, "b1": b1, "b2c": b2_curves, "b2i": b2_images}
for job in (sys.argv[1:] or JOBS):
    JOBS[job]()
