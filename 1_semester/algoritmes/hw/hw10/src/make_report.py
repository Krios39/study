import base64
import csv
import io
import json
from pathlib import Path
from statistics import median

from PIL import Image

from nb import helpers

SRC = Path(__file__).resolve().parent
HW = SRC.parent
h = helpers()

TD = 'style="padding: 10px; border: 1px solid #cbd5e1;"'
NOTE = 'style="font-size: 13px; color: #475569;"'


def table(headers, rows):
    head = "".join(f"<th {TD}>{x}</th>" for x in headers)
    body = ""
    for i, row in enumerate(rows):
        bg = ' style="background: #f8fafc;"' if i % 2 else ""
        body += f"<tr{bg}>" + "".join(f"<td {TD}>{c}</td>" for c in row) + "</tr>\n"
    return ('<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; text-align: left;">\n'
            f'<thead><tr style="background: #e2e8f0; color: #333;">{head}</tr></thead>\n<tbody>\n{body}</tbody>\n</table></div>')


def figure(path, alt, caption=None, width=1100):
    img = Image.open(path).convert("RGB")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    text = f'<p style="font-size: 13px; text-align: center; margin-top: 4px;">{caption}</p>' if caption else ""
    return (f'<div><img src="{uri}" alt="{alt}" style="width: 100%; height: auto; border: 1px solid #ccc; '
            f'border-radius: 4px; margin-top: 10px;">{text}</div>')


def load(path):
    return json.loads(Path(path).with_suffix(".json").read_text())


def history(path):
    with Path(path).with_suffix(".csv").open() as handle:
        return [float(row["best_fitness"]) for row in csv.DictReader(handle)]


def f(x, digits=5):
    return f"{x:.{digits}f}"


def coefficients(values):
    return "[" + ", ".join(f"{v:.3f}" for v in values) + "]"


line = h["polynomial_data"]("line")
t1 = {name: load(SRC / "t1" / f"T1_{name}") for name in ("MAE", "MedAE")}
t1_hist = {name: history(SRC / "t1" / f"T1_{name}") for name in t1}
t1_rows = []
for name, run in t1.items():
    m = h["fit_metrics"](line, run["best"])
    t1_rows.append([name, coefficients(run["best"]), f(m["training_MAE"]), f(m["training_MedAE"]), f(m["held_out_MAE"]),
                    f(m["held_out_MedAE"]), f"{run['evaluations']:,}", f"{run['search_seconds']:.3f} s"])
m = h["fit_metrics"](line, line["truth"])
t1_rows.append(["original line (evaluation only)", coefficients(line["truth"]), f(m["training_MAE"]), f(m["training_MedAE"]), "0", "0", "—", "—"])
CUTS = (40, 200, 400, 1000, 2000, 4000, 8000)
t1_cut_rows = [[name] + [f(t1_hist[name][c - 1]) for c in CUTS] for name in t1]

t1_html = f"""<details>
    <summary>Task T1: Fit a line using simple DE</summary>
    <div class="details-content">

        <h3>Method</h3>
        <ul>
            <li><strong>Data and model:</strong> the notebook's line dataset (100 observations, data seed 2026), model <code>y = b + a·x</code>, candidate <code>[b, a]</code>, bounds [−3, 3] for both.</li>
            <li><strong>Simple DE (own code, <code>de.py</code>):</strong> population 40, F = 0.8, optimiser seed 0. The initial population (supplied by the notebook) is scored first. In every generation, a snapshot of the previous generation is taken. For each target, three distinct other members r1, r2, r3 are drawn from the snapshot, the donor <code>r1 + F·(r2 − r3)</code> is formed coordinate by coordinate and clipped to the bounds, and the whole donor is scored. It replaces the target if its fitness is no worse.</li>
            <li><strong>Bookkeeping:</strong> the score of every member is stored next to it, so survivors are never re-scored. Every fitness comes from the supplied counter <code>run(candidate)</code>; <code>run.remaining</code> is checked before each evaluation, so the search stops exactly at the budget, also within a generation.</li>
            <li><strong>Runs:</strong> one for MAE and one for MedAE, each with a fresh counter.</li>
            <li><strong>Budget: 8,000 evaluations per run</strong> (the suggested value). It covers the initial 40 and 199 generations. Two parameters need much less: the cutoff table below shows that both runs are within 0.00002 of their final fitness after 2,000 evaluations, so the rest of the budget only confirms convergence.</li>
        </ul>

        <h3>Results</h3>
        {table(["Objective", "Best [b, a]", "Training MAE", "Training MedAE", "Held-out MAE", "Held-out MedAE", "Evaluations", "Search time"], t1_rows)}
        <p {NOTE}>Held-out = the clean original line on 501 points in [−1, 1], used only after the search.</p>
        <p>Best-so-far fitness at earlier cutoffs of the same runs:</p>
        {table(["Objective"] + [f"{c:,}" for c in CUTS], t1_cut_rows)}
        {figure(SRC / "t1" / "T1_fits.png", "Observations, original line and both fitted lines")}
        {figure(SRC / "t1" / "T1_landscapes.png", "3D fitness landscapes", "Training fitness landscapes over the whole box, red dot = the returned solution")}
        {figure(SRC / "t1" / "T1_landscapes_contours.png", "Contour fitness landscapes", "The same landscapes as contours")}
        {figure(SRC / "t1" / "T1_MAE_progress.png", "MAE progress")}
        {figure(SRC / "t1" / "T1_MedAE_progress.png", "MedAE progress")}

        <h3>Discussion</h3>
        <ul>
            <li><strong>What the landscape suggests:</strong> MAE is a smooth convex bowl with a single minimum. Its valley is stretched along the slope axis, because x lies in [−1, 1], so a change in slope moves the line less than the same change in intercept. Any reasonable search reaches the bottom; DE gets there in about 1,000 evaluations.
                MedAE has the same overall shape, but its surface is ragged: the contours are jagged and the bottom is a wide, uneven plateau with many small steps. This is because the median switches from one residual to another as the line moves. Gradient methods would have trouble here; DE only compares fitness values, so the roughness hardly affects it, but the search makes progress in small jumps instead of smoothly.</li>
            <li><strong>Both fits are better than the original line on the training data</strong> (MAE {f(h["fit_metrics"](line, t1["MAE"]["best"])["training_MAE"])} vs {f(h["fit_metrics"](line, line["truth"])["training_MAE"])}). The search is not wrong: it fits this particular noise. Training fitness alone therefore cannot tell how close a fit is to the true line.</li>
            <li><strong>A smaller MedAE than MAE is not evidence of a better fit.</strong> The MedAE fit has the lower training score, but it is the worse fit: its held-out MAE is {f(h["fit_metrics"](line, t1["MedAE"]["best"])["held_out_MAE"], 4)}, against {f(h["fit_metrics"](line, t1["MAE"]["best"])["held_out_MAE"], 4)} for the MAE fit, and the line is visibly shifted upwards. The two numbers are different measures: the median ignores the larger half of the residuals, so it is always the smaller one and depends on fewer points, which makes the fit noisier. With no outliers in this dataset, its robustness gives no benefit.</li>
        </ul>
    </div>
</details>
"""

t2_data = h["t2_datasets"]()
t2_rows = []
t2 = {}
for index, data in enumerate(t2_data):
    for name in ("MAE", "MedAE"):
        run = t2[index, name] = load(SRC / "t2" / f"T2_{index}_{name}")
        m = h["fit_metrics"](data, run["best"])
        t2_rows.append([data["name"], f"{data['outlier_fraction']:.0%}", name, coefficients(run["best"]), f(m["training_MAE"]),
                        f(m["training_MedAE"]), f(m["held_out_MAE"]), f(m["held_out_MedAE"]), f"{run['evaluations']:,}", f"{run['search_seconds']:.2f} s"])
truth_rows = []
for index in (0, 1):
    data = t2_data[index]
    m = h["fit_metrics"](data, data["truth"])
    truth_rows.append([f"{data['outlier_fraction']:.0%}", f(m["training_MAE"]), f(m["training_MedAE"])])
q_cut = {name: history(SRC / "t2" / f"T2_3_{name}") for name in ("MAE", "MedAE")}
Q_CUTS = (1000, 2000, 4000, 8000, 16000)
held = lambda index, name: f(h["fit_metrics"](t2_data[index], t2[index, name]["best"])["held_out_MAE"], 3)

t2_html = f"""<details>
    <summary>Task T2: More parameters, noise and outliers</summary>
    <div class="details-content">

        <h3>Method</h3>
        <ul>
            <li><strong>Data:</strong> the notebook's cubic <code>[0.1, −2.4, 0.2, 2.7]</code> and degree-five <code>[0.1, 1.8, −0.8, −5.0, 0.4, 3.5]</code> polynomials (coefficients lowest power first), each with 0% and 20% outliers, data seed 2026. All four datasets share the same x-values and noise; contamination only shifts 20 observations upwards by 3–6. Bounds [−6, 6] for every coefficient.</li>
            <li><strong>Search:</strong> the unchanged T1 DE (whole donor), population 40, F = 0.8, optimiser seed 0, starting from the supplied random population. MAE and MedAE are optimised separately: eight fits.</li>
            <li><strong>Budget: 16,000 evaluations per fit.</strong> A first try with the suggested 8,000 showed that MAE settles after 4,000–8,000 evaluations, but MedAE was still improving at 8,000 on the degree-five data (see the cutoff table below: 0.0786 at 4,000, 0.0728 at 8,000, 0.0717 at 16,000 on the contaminated case). The doubled budget lets the slower objective finish its search; the same value is used in T3, where this dataset is studied further.</li>
        </ul>

        <h3>Results</h3>
        {table(["Data", "Outliers", "Objective", "Best coefficients", "Training MAE", "Training MedAE", "Held-out MAE", "Held-out MedAE", "Evaluations", "Search time"], t2_rows)}
        <p {NOTE}>For comparison, the original curves themselves score training MAE / MedAE {truth_rows[0][1]} / {truth_rows[0][2]} on the clean data and {truth_rows[1][1]} / {truth_rows[1][2]} on the contaminated data (the noise and outliers are the same for both degrees).</p>
        {figure(SRC / "t2" / "T2_fits.png", "Four datasets with original curves and both fits")}
        <p>Contaminated degree-five case, best-so-far fitness at earlier cutoffs:</p>
        {table(["Objective"] + [f"{c:,}" for c in Q_CUTS], [[name] + [f(q_cut[name][c - 1]) for c in Q_CUTS] for name in q_cut])}
        {figure(SRC / "t2" / "T2_quintic_outliers_MAE_progress.png", "Progress, contaminated degree five, MAE")}
        {figure(SRC / "t2" / "T2_quintic_outliers_MedAE_progress.png", "Progress, contaminated degree five, MedAE")}

        <h3>Discussion</h3>
        <ul>
            <li><strong>Which objective recovers the curve better?</strong> Here MAE, in all four cases, including the contaminated ones (held-out MAE {held(1, "MAE")} vs {held(1, "MedAE")} on the cubic and {held(3, "MAE")} vs {held(3, "MedAE")} on degree five).
                This is because MAE is already robust: unlike a squared error, every observation pulls the curve with the same force, however far away it lies, so an outlier 5 units above counts no more than a point 0.1 above. Twenty one-sided outliers move the MAE fit only slightly upwards. MedAE is robust as well, but it is decided by the closest half of the observations only, so it uses less of the data and is noisier.</li>
            <li><strong>Can a low median error hide a poor fit elsewhere?</strong> Yes. On the clean degree-five data the MedAE fit reaches a training MedAE of {f(h["fit_metrics"](t2_data[2], t2[2, "MedAE"]["best"])["training_MedAE"], 4)}, lower than the original curve's {truth_rows[0][2][:6]}, but its held-out MAE is {held(2, "MedAE")}, three times that of the MAE fit, and at the right end the curve keeps falling to about −0.45 at x = 1 while the observations rise to 0. The median does not care how badly the worst half of the points is missed. A more extreme example is in T3 (CR = 0, seed 0).</li>
            <li><strong>Median fitting does not delete outliers.</strong> It simply stops paying attention to the worse half of the residuals, which contains the outliers, but also ordinary points.</li>
            <li><strong>Search behaviour:</strong> MAE improves smoothly and converges early. MedAE goes down in steps with long flat stretches: on its rough landscape the population often needs many trials before any one of them is better. More coefficients need more search: the MAE runs settle after about 4,000 (cubic) and 8,000 (degree five) evaluations, against about 1,000 for the line.</li>
        </ul>
    </div>
</details>
"""

t3_runs = [load(SRC / "t3" / f"T3_{i}") for i in range(18)]
t3_data = t2_data[3]
t3_run_rows = []
for r in t3_runs:
    s = r["settings"]
    reached = f"{r['target_evaluation']:,} ({r['target_seconds']:.2f} s)" if r["reached"] else "not reached"
    t3_run_rows.append([str(s["population"]), str(s["CR"]), str(r["seed"]), f(r["best_fitness"]), reached,
                        f(h["fit_metrics"](t3_data, r["best"])["held_out_MAE"], 3), f"{r['evaluations']:,}", f"{r['search_seconds']:.2f} s"])
groups, group_index = {}, {}
for i, r in enumerate(t3_runs):
    key = (r["settings"]["population"], r["settings"]["CR"])
    groups.setdefault(key, []).append(r)
    group_index.setdefault(key, []).append(i)


def group_row(key):
    trials = groups[key]
    finals = [r["best_fitness"] for r in trials]
    hits = [r["target_evaluation"] for r in trials if r["reached"]]
    early = [median(history(SRC / "t3" / f"T3_{i}")[c - 1] for i in group_index[key]) for c in (1000, 2000, 4000)]
    return [str(key[0]), str(key[1]), f"{f(median(finals), 4)} [{f(min(finals), 4)}, {f(max(finals), 4)}]", f"{len(hits)}/3",
            f"{median(hits):,.0f}" if len(hits) == 3 else "—", *[f(v, 3) for v in early],
            f(median(h["fit_metrics"](t3_data, r["best"])["held_out_MAE"] for r in trials), 3)]


GROUP_HEAD = ["Population", "CR", "Final MedAE: median [min, max]", "Reached 0.10", "Median evaluation to 0.10",
              "Median best at 1,000", "at 2,000", "at 4,000", "Median held-out MAE"]
cr_rows = [group_row((40, cr)) for cr in (1.0, 0.7, 0.3, 0.0)]
pop_rows = [group_row((p, 0.7)) for p in (20, 40, 80)]
seconds = [r["search_seconds"] for r in t3_runs]

t3_html = f"""<details>
    <summary>Task T3: Introduce crossover: does it help?</summary>
    <div class="details-content">

        <h3>Method</h3>
        <ul>
            <li><strong>Data and objective:</strong> the T2 degree-five dataset with 20% outliers, MedAE. It was kept: it shows the effect clearly.</li>
            <li><strong>Binomial crossover (added to the same <code>de.py</code>):</strong> after the donor is formed, one coordinate index is drawn at random, and the trial takes that coordinate from the donor; every other coordinate comes from the donor with probability CR and from the target otherwise. Bounds and the "no worse" replacement are unchanged. CR = 1.0 is exactly the T1/T2 method; CR = 0.0 takes one donor coordinate.</li>
            <li><strong>Crossover comparison:</strong> CR = 1.0, 0.7, 0.3, 0.0 with population 40, F = 0.8, seeds 0, 1, 2: 12 runs. Within a seed all settings start from the same initial population (the notebook generates it with a separate random generator).</li>
            <li><strong>Further parameter: population size</strong> 20 and 80 at CR = 0.7, F = 0.8, seeds 0–2: 6 more runs; population 40 is reused from the crossover comparison.</li>
            <li><strong>Budget: 16,000 evaluations per run</strong>, the same as in T2, for all 18 runs. All runs used the full budget. The MedAE target 0.10 is recorded as a milestone; the runs continue past it.</li>
            <li><strong>Reuse:</strong> the run CR = 1.0, seed 0 has the same data, budget and settings as the T2 run and gives the identical result ({f(groups[40, 1.0][0]["best_fitness"])}). T1–T3 were all rerun with the final code.</li>
            <li><strong>Timing caveat:</strong> one evaluation costs the same for every setting, but the measured search times of identical runs varied by up to {max(seconds) / min(seconds):.1f}× ({min(seconds):.2f}–{max(seconds):.2f} s here) because the laptop changes its CPU clock over time: repeating the same configurations in a different order gave different times. Search times are reported, but the comparisons below are based on evaluations.</li>
        </ul>

        <h3>Results: All Runs</h3>
        {table(["Population", "CR", "Seed", "Final MedAE", "First reached 0.10: evaluation (time)", "Held-out MAE", "Evaluations", "Search time"], t3_run_rows)}

        <h3>Crossover Rate</h3>
        {table(GROUP_HEAD, cr_rows)}
        {figure(SRC / "t3" / "T3_crossover_progress.png", "Progress for all crossover rates and seeds", "Best-so-far MedAE (log scale) for all four CR values and three seeds; grey line = target 0.10")}
        {figure(SRC / "t3" / "T3_fits_seed0.png", "Final curves for each CR, seed 0", "Final curves of seed 0 for each CR")}

        <h3>Population Size at CR = 0.7</h3>
        {table(GROUP_HEAD, pop_rows)}
        {figure(SRC / "t3" / "T3_population_progress.png", "Progress for all population sizes and seeds", "Best-so-far MedAE (log scale) for populations 20, 40 and 80 at CR = 0.7")}

        <h3>Discussion</h3>
        <ul>
            <li><strong>Crossover does not help on this problem; the lower CR, the worse.</strong> CR = 1.0 is fastest (median {cr_rows[0][4]} evaluations to reach 0.10) and has the best final MedAE. CR = 0.7 also reaches the target in all seeds, but later. CR = 0.3 reaches it once and CR = 0.0 never.</li>
            <li><strong>Why:</strong> polynomial coefficients are strongly coupled. Changing one of them alone spoils the curve unless others change with it. The DE step <code>F·(r2 − r3)</code> moves all coefficients together, in a direction taken from the population itself. Crossover with a low CR breaks this step into moves along single axes, which suit independent (separable) parameters, not coupled ones.</li>
            <li><strong>Early progress, accuracy, reliability:</strong> crossover is worse for early progress and for final training MedAE. For reliability, CR = 1.0 and 0.7 give almost the same result in every seed, while CR = 0.3 and 0.0 vary much more. On the original curve CR = 0.7 is in fact slightly closer (held-out MAE {cr_rows[1][8]} against {cr_rows[0][8]}), another case where a lower training MedAE does not mean a better curve; with three seeds this difference is within the noise.</li>
            <li><strong>Low median, poor fit:</strong> CR = 0.0, seed 0 is the clearest example. It follows the observations up to about x = 0.6, but then the curve shoots up to about 7 at x = 1. The points it misses are fewer than half, so the median does not notice.</li>
            <li><strong>Population size:</strong> with a fixed budget, population 20 gets 800 generations and population 80 only 200. Here the landscape has one main valley and diversity is not the bottleneck, so the smaller population wins (median final {pop_rows[0][2].split()[0]} vs {pop_rows[2][2].split()[0]}) and reaches the target earlier. Its risk, early convergence into a wrong valley, did not appear in these runs. A smaller population partly offsets the slower progress of CR = 0.7: population 20 at CR = 0.7 almost catches up with population 40 at CR = 1.0. So the population changes the trade-off between progress per evaluation and diversity, but not the ranking of CR values.</li>
            <li><strong>Limits:</strong> three seeds show the variability, not a statistically significant difference. No setting failed technically; the "not reached" cases are kept in the tables.</li>
        </ul>
    </div>
</details>
"""

PI = 3.141592653589793
t4 = json.loads((SRC / "t4" / "T4_summary.json").read_text())
t4_data = {d["name"]: d for d in (h["wave_data"](1), h["wave_data"](2))}


def waves(values):
    parts = [f"trend [{values[0]:.3f}, {values[1]:.3f}, {values[2]:.3f}]"]
    for i in range(3, len(values), 3):
        parts.append(f"{values[i]:.3f}·sin({values[i + 1] / PI:.3f}π·x {'+' if values[i + 2] >= 0 else '−'} {abs(values[i + 2]):.3f})")
    return "<br>".join(parts)


t4_rows = []
for name, data in t4_data.items():
    m = h["fit_metrics"](data, data["truth"])
    t4_rows.append([name, "original (evaluation only)", waves(data["truth"]), f(m["training_MAE"]), "0", "—", "—"])
    for r in (r for r in t4 if r["case"] == name):
        t4_rows.append([name, str(r["seed"]), waves(r["best"]), f(r["metrics"]["training_MAE"]), f(r["metrics"]["held_out_MAE"]),
                        f"{r['evaluations']:,}", f"{r['seconds']:.2f} s"])
T4_CUTS = ("1000", "2000", "4000", "8000", "16000")
t4_cut_rows = [[r["case"], str(r["seed"])] + [f(r["cutoffs"][c], 3) for c in T4_CUTS] for r in t4]
t4_middle = []
for seed in (0, 1, 2):
    snaps = load(SRC / "t4" / f"T4_two-wave_{seed}")["snapshots"]
    for evaluation in (2000, 4000, 6000, 8000):
        s = next(s for s in snaps if s["evaluation"] == evaluation)
        b = s["best"]
        t4_middle.append([str(seed), f"{evaluation:,}", f(s["fitness"], 3),
                          f"{b[4] / PI:.2f}π (A = {b[3]:.2f})", f"{b[7] / PI:.2f}π (A = {b[6]:.2f})"])
t4_two = [r for r in t4 if r["case"] == "two-wave"]
t4_one = [r for r in t4 if r["case"] == "one-wave"]

t4_html = f"""<details>
    <summary>Task T4: Unknown frequencies, a harder landscape</summary>
    <div class="details-content">

        <h3>Method</h3>
        <ul>
            <li><strong>Data and models:</strong> the notebook's one-wave and two-wave datasets (180 observations each, no outliers): <code>y = c0 + c1·x + c2·x² + A1·sin(w1·x + φ1)</code>, and the same plus <code>A2·sin(w2·x + φ2)</code>. Six and nine parameters, in the supplied order and bounds: trend [−2, 2], amplitudes [0.2, 2], phases [−π, π], frequencies [π, 8π] for one wave and [π, 16π] for two.</li>
            <li><strong>Search:</strong> the same <code>de.py</code> as in T3, with the settings fixed by the task: MAE, population 40, F = 0.8, CR = 0.7, seeds 0, 1, 2 on each dataset: six runs.</li>
            <li><strong>Budget: 16,000 evaluations per run</strong> (the suggested value). The cutoff table below justifies it: with 8,000 evaluations the one-wave runs have already converged, but none of the two-wave runs has (best MAE 0.12–0.19 against a final 0.075). 16,000 gives the harder case roughly twice the evaluations it needs. All six runs used the full budget.</li>
        </ul>

        <h3>Results</h3>
        {table(["Data", "Seed", "Best curve", "Training MAE", "Held-out MAE", "Evaluations", "Search time"], t4_rows)}
        <p {NOTE}>Held-out = the clean original curve on 501 points, used only after the search. Phases are shown as found; the frequencies are written as multiples of π.</p>
        {figure(SRC / "t4" / "T4_one-wave_fits.png", "One-wave data with all three final fits")}
        {figure(SRC / "t4" / "T4_two-wave_fits.png", "Two-wave data with all three final fits")}
        <p>Best-so-far training MAE at earlier cutoffs of the same runs:</p>
        {table(["Data", "Seed"] + [f"{int(c):,}" for c in T4_CUTS], t4_cut_rows)}
        {figure(SRC / "t4" / "T4_one-wave_progress.png", "Progress, one wave")}
        {figure(SRC / "t4" / "T4_two-wave_progress.png", "Progress, two waves")}

        <h3>The Competing Fit in the Two-Wave Case</h3>
        <p>Best candidate of each two-wave run at intermediate points (from the saved snapshots):</p>
        {table(["Seed", "Evaluation", "Best MAE", "First sine: frequency (amplitude)", "Second sine: frequency (amplitude)"], t4_middle)}
        {figure(SRC / "t4" / "T4_two-wave_at_4000.png", "Two-wave best curves at 4,000 evaluations", "Best curves of the two-wave runs after 4,000 evaluations: only the strong 6.1π wave is fitted")}

        <h3>Discussion</h3>
        <ul>
            <li><strong>All six runs recover the original curve.</strong> The frequencies are found to within 0.01π (3.20π; 6.10π and 11.69π against the true 3.2π; 6.1π and 11.7π), and all final curves lie on top of the original. No run failed, so there is no final run that fits the observations but misses the curve. The training MAE of every fit is slightly below that of the original curve (one wave {f(t4_one[0]["metrics"]["training_MAE"], 4)}, two waves {f(t4_two[0]["metrics"]["training_MAE"], 4)} against {f(h["fit_metrics"](t4_data["one-wave"], t4_data["one-wave"]["truth"])["training_MAE"], 4)}): as in T1, the fits follow this particular noise a little.</li>
            <li><strong>Why the frequency makes the landscape hard:</strong> if w is slightly wrong, the fitted sine drifts out of phase across the interval and the error grows; if it is further off, the sine can again agree with part of the points. Along w the fitness therefore has many local minima, unlike the polynomial coefficients in T2, where a single valley was found.</li>
            <li><strong>The two-wave case is clearly harder.</strong> One wave is found after about 4,000–6,000 evaluations. Two waves stay for a long time on a competing fit (table and figure above): the strong wave at 6.1π, amplitude 1.2, is already in place, but the second one is "switched off", with its amplitude at the lower bound 0.2 and its frequency wandering (13π, 15π, 16π). One strong wave explains much of the data, and a guess for the weaker high-frequency wave only helps when its frequency is almost exactly right, otherwise it adds error. The runs leave this plateau between about 6,000 and 9,000 evaluations. At 2,000 evaluations seed 1 even had the two waves in swapped roles (16π and 6.2π), an example of the exchange the task mentions: the order of the sine terms does not matter for the curve.</li>
            <li><strong>A plateau is not proof of a global optimum.</strong> In the progress plot the two-wave runs show long flat stretches around MAE 0.5 that look like convergence but are not. The final plateau at 0.075 is very probably the right one, because it matches the original curve and is below the original curve's own training MAE, but this is checked with the held-out data after the search, not by the search itself.</li>
            <li><strong>Held-out error:</strong> two-wave fits are about twice as far from the original curve as one-wave fits ({f(t4_two[0]["metrics"]["held_out_MAE"], 3)}–{f(max(r["metrics"]["held_out_MAE"] for r in t4_two), 3)} against {f(t4_one[0]["metrics"]["held_out_MAE"], 3)}): with nine parameters and the same 180 points, more of the noise is absorbed into the fit.</li>
        </ul>
    </div>
</details>
"""

t5_logs = sorted((SRC / "t5").glob("T5_*_circles_50_seed_*_budget_3000_log.json"), key=lambda p: p.name)
t5 = [json.loads(p.read_text()) for p in t5_logs]
t5_hist = [history(p.with_suffix("")) for p in t5_logs]
T5_CUTS = (500, 1000, 2000, 3000)
t5_rows = []
for r, hist in zip(t5, t5_hist):
    initial = next(s for s in r["snapshots"] if s["evaluation"] == 20)
    t5_rows.append([str(r["seed"]), f(initial["fitness"])] + [f(hist[c - 1]) for c in T5_CUTS] +
                   [f"{r['evaluations']:,}", f"{r['search_seconds']:.1f} s"])
t5_settings = t5[0]["settings"]
t5_seconds = [r["search_seconds"] for r in t5]
t5_first = t5_logs[0].name.replace("_log.json", "")

t5_html = f"""<details>
    <summary>Task T5: Evolve an image with 50 circles</summary>
    <div class="details-content">

        <h3>Target</h3>
        <ul>
            <li><strong>Image:</strong> Konrad Mägi, <em>Venice</em> (file <code>Konrad-Mägi-Venice.jpg</code> from the course image folder). Original 1188 × 1000 pixels; working target 128 × 108 (longest side 128, aspect ratio kept, the notebook's resizer). The working copy is saved with every run as <code>…_target.png</code>.</li>
            <li><strong>Representation and score:</strong> unchanged from the image notebook: 50 circles of seven values <code>[x, y, radius, R, G, B, opacity]</code> drawn in list order on white, score = mean squared RGB error on [0, 1]. One complete rendered image = one evaluation.</li>
        </ul>
        {figure(SRC / "t5" / "T5_target.png", "Original and working target", width=900)}

        <h3>Genetic Algorithm (own code, <code>ga.py</code>)</h3>
        <ul>
            <li><strong>Population 20</strong>, started from the notebook's random population; all 20 are scored first and the best initial image is kept as a snapshot.</li>
            <li><strong>Parent selection:</strong> binary tournament. Two different members are drawn at random and the better one becomes a parent; this is done separately for each of the two parents.</li>
            <li><strong>Crossover:</strong> uniform over whole circles. For each of the 50 positions the child takes the complete seven-value circle from one parent or the other with probability ½, so a circle is never split.</li>
            <li><strong>Mutation:</strong> every one of the 350 values is changed with probability 1/50 (about 7 values per child) by adding a Gaussian step with standard deviation 10% of that value's range, then clipped to its bounds.</li>
            <li><strong>Elitism and replacement:</strong> the best member passes to the next generation unchanged with its stored score (never re-scored); the other 19 places are filled with new children. Each child is scored once through <code>run(child)</code>, and the search stops exactly at the budget, also within a generation.</li>
            <li><strong>Debugging</strong> was done with 5 circles and 200 evaluations (MSE 0.135 → 0.060), not shown.</li>
            <li><strong>Budget: 3,000 evaluations per run</strong> (the suggested value): the initial 20 and about 157 generations of 19 children. One evaluation takes about {sum(t5_seconds) / len(t5_seconds) / 3000 * 1000:.0f} ms at this size, so a run takes {min(t5_seconds):.0f}–{max(t5_seconds):.0f} s. Seeds 0, 1, 2, same image, resolution and settings.</li>
        </ul>

        <h3>Results</h3>
        {table(["Seed", "Best initial MSE (eval 20)"] + [f"at {c:,}" for c in T5_CUTS[:-1]] + ["Final MSE (3,000)", "Evaluations", "Search time"], t5_rows)}
        <p {NOTE}>Every final genome was exported with the notebook's exporter (JSON genome, recomputed PNG, working target PNG, full log) and its score was recomputed independently by <code>verify_image_export</code>; files <code>t5/T5_128x108_…_circles_50_seed_N_budget_3000.*</code>.</p>
        {figure(SRC / "t5" / "T5_c50_b3000_progress.png", "Best MSE against evaluations and time, all seeds")}
        {"".join(figure(SRC / "t5" / f"T5_c50_b3000_seed{s}_evolution.png", f"Seed {s} images", f"Seed {s}: target, best initial image (evaluation 20), intermediate and final best images") for s in (0, 1, 2))}

        <h3>Discussion</h3>
        <ul>
            <li><strong>Improvement:</strong> all three seeds reduce the error by a factor of {min(float(r[1]) / x['best_fitness'] for r, x in zip(t5_rows, t5)):.1f}–{max(float(r[1]) / x['best_fitness'] for r, x in zip(t5_rows, t5)):.1f}, from {min(float(r[1]) for r in t5_rows):.3f}–{max(float(r[1]) for r in t5_rows):.3f} for the best random image to {min(r["best_fitness"] for r in t5):.4f}–{max(r["best_fitness"] for r in t5):.4f}. The seeds behave very similarly. Most of the improvement happens in the first 500 evaluations; after that the curve keeps falling slowly, so 3,000 evaluations is not the limit of this GA.</li>
            <li><strong>What improves visibly:</strong> first the overall colour: the random greens and pinks are replaced by the painting's blues within a few hundred evaluations. Then only the large layout appears: darker blue water at the bottom, a lighter area in the middle and upper right where the light sky and the pale right sail are, darker edges. The red sails, the houses and the boats do not appear at all.</li>
            <li><strong>What the pixel error overlooks:</strong> the recognisable details (the red sails, the bell tower, the boats, the outlines of the buildings) cover few pixels, so drawing them earns almost nothing, while a slightly wrong average colour over a large area costs a lot. The squared error therefore favours large, soft, translucent circles that match the average colour, i.e. a blurry image. It also does not care about edges and contrast, which matter most to a human viewer: an image with sharp shapes but slightly shifted colours could look closer to the painting and still score worse.</li>
            <li><strong>Time:</strong> one image evaluation (about {sum(t5_seconds) / len(t5_seconds) / 3000 * 1000:.0f} ms) is a few hundred times more expensive than one curve evaluation in T4 (about {sum(r['seconds'] for r in t4) / len(t4) / 16000 * 1000:.2f} ms), so the budget here is smaller. The renderer's cost grows with the number of pixels and the circle sizes; the measured times also include the laptop's CPU clock changes (see T3).</li>
        </ul>
    </div>
</details>
"""

intro = f"""<details open>
    <summary>Setup and Notes</summary>
    <div class="details-content">
        <ul>
            <li><strong>Code:</strong> Python 3.14. The search is my own differential evolution in <code>de.py</code> (standard Python: <code>random</code> and lists only). The course helpers (data generators, scoring, the evaluation counter <code>FitnessRun</code>, runners and plots) are loaded unchanged from the supplied notebook <code>HW10_DE_Fitting_2026.ipynb</code> by <code>nb.py</code>. The genetic algorithm for T5 is in <code>ga.py</code> (also standard Python only); the image helpers (loader, resizer, renderer, scorer, counter, exporter and verifier) are loaded unchanged from <code>HW10_Image_Evolution_2026.ipynb</code>. <code>T1.py</code>–<code>T5.py</code> run the experiments; all per-run CSV/JSON logs with settings and seeds are in <code>t1/</code>–<code>t5/</code>, together with the console logs <code>T*_log.txt</code>.</li>
            <li><strong>Training and evaluation are separate:</strong> every search decision uses only the training fitness from the counter. The original curve and the held-out values (the clean curve on 501 points in [−1, 1]) are computed after the search, for the tables only. Landscapes are diagnostic grids, not part of the search. In T5 only the working target image is used.</li>
            <li><strong>Budgets:</strong> T1 8,000, T2–T4 16,000 and T5 3,000 evaluations per run; the reasons are given in each task. Every run used its full budget.</li>
            <li><strong>Assistance:</strong> an AI coding assistant helped to write the code and the report text. The algorithm choices were mine; I checked the code and the results.</li>
        </ul>
    </div>
</details>
"""

head = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>HW10. Evolutionary optimisation: curves and images</title>
    <meta name="reference" content="Python | https://www.python.org/">
    <meta name="reference" content="NumPy, Matplotlib, Pillow (course helpers and figures) | https://numpy.org/">
    <link rel="stylesheet" href="../../styles.css">
    <script src="../../header.js" defer></script>
    <script src="../../footer.js" defer></script>
</head>
<body>
"""

(HW / "report.html").write_text(head + intro + t1_html + t2_html + t3_html + t4_html + t5_html + "</body>\n</html>\n", encoding="utf-8")
print("report written", (HW / "report.html").stat().st_size)
