use plotters::prelude::RGBColor;
use serde_json::json;

use hw8::draw::{bar_panels, error_chart, graph_values_row};
use hw8::*;

const DATA: &str = "HW8_graph_data.json";
const START: usize = 0;

fn seed(weighted: bool, t: usize, m: usize, rep: usize) -> u64 {
    20260800 + if weighted { 0 } else { 5_000_000 } + 100_000 * t as u64 + m as u64 + 1_000_000_000 * rep as u64
}

fn predicted(p: &[Vec<f64>], t: usize) -> Vec<Vec<f64>> {
    let mut v = vec![0.0; p.len()];
    v[START] = 1.0;
    let mut out = vec![v.clone()];
    for _ in 0..t {
        v = vector_step(&v, p);
        out.push(v.clone());
    }
    out
}

fn is_distribution(v: &[f64]) -> bool {
    v.iter().all(|&x| x >= 0.0) && (v.iter().sum::<f64>() - 1.0).abs() < 1e-12
}

fn frequencies(sampler: &Sampler, t: usize, m: usize, s: u64) -> Vec<f64> {
    let mut rng = SplitMix64(s);
    sampler.endpoints(START, t, m, &mut rng).iter().map(|&c| c as f64 / m as f64).collect()
}

fn expected_l1(p: &[f64], m: usize) -> f64 {
    p.iter().map(|&x| (2.0 * x * (1.0 - x) / (std::f64::consts::PI * m as f64)).sqrt()).sum()
}

fn main() {
    let web = Graph::load(DATA, "web_base");
    let n = web.n();
    let pw = transition(&web, true);
    let pu = transition(&web, false);
    let rows_ok = pw.iter().chain(&pu).all(|r| is_distribution(r));
    let sw = Sampler::new(&pw);
    let su = Sampler::new(&pu);
    let pred_w = predicted(&pw, 10);
    let pred_u = predicted(&pu, 10);
    let vectors_ok = pred_w.iter().chain(&pred_u).all(|v| is_distribution(v));
    println!("rows of P sum to 1: {rows_ok}; all predicted vectors are distributions: {vectors_ok}");

    let mut table = Vec::new();
    let mut empirical = serde_json::Map::new();
    let mut runs = vec![(true, 1, 1000), (true, 1, 10000), (true, 3, 1000), (true, 3, 10000), (true, 10, 1000), (true, 10, 10000), (false, 10, 10000)];
    runs.push((false, 10, 1000));
    for &(weighted, t, m) in &runs {
        let s = seed(weighted, t, m, 0);
        let (sampler, pred) = if weighted { (&sw, &pred_w) } else { (&su, &pred_u) };
        let f = frequencies(sampler, t, m, s);
        let d = l1(&f, &pred[t]);
        let ok = is_distribution(&f) || (f.iter().sum::<f64>() - 1.0).abs() < 1e-9;
        println!("{} t={t:2} M={m:5} seed={s} L1={d:.4} expected~{:.4}", if weighted { "weighted" } else { "uniform " }, expected_l1(&pred[t], m));
        table.push(json!({"rule": if weighted { "weighted" } else { "uniform" }, "t": t, "M": m, "seed": s, "l1": d,
                          "expected_l1": expected_l1(&pred[t], m), "frequencies_sum_to_one": ok}));
        empirical.insert(format!("{}_{t}_{m}", if weighted { "weighted" } else { "uniform" }), json!(f));
    }

    let ms = [100usize, 300, 1000, 3000, 10000, 30000];
    let reps = 40;
    let mut repeat = Vec::new();
    let colors = [RGBColor(37, 99, 235), RGBColor(22, 163, 74), RGBColor(220, 38, 38)];
    let mut series = Vec::new();
    for (ci, &t) in [1usize, 3, 10].iter().enumerate() {
        let mut pts = Vec::new();
        let mut means = Vec::new();
        let mut theory = Vec::new();
        let mut per_m = Vec::new();
        for &m in &ms {
            let ds: Vec<f64> = (1..=reps).map(|r| l1(&frequencies(&sw, t, m, seed(true, t, m, r)), &pred_w[t])).collect();
            ds.iter().for_each(|&d| pts.push((m as f64 * (0.94 + 0.12 * ci as f64), d)));
            let mean = ds.iter().sum::<f64>() / reps as f64;
            means.push((m as f64, mean));
            theory.push((m as f64, expected_l1(&pred_w[t], m)));
            per_m.push(ds);
        }
        let i1 = ms.iter().position(|&m| m == 1000).unwrap();
        let i2 = ms.iter().position(|&m| m == 10000).unwrap();
        let better = (0..reps).filter(|&r| per_m[i2][r] < per_m[i1][r]).count();
        let worse_pairs = (0..reps).filter(|&r| per_m[i2][r] >= per_m[i1][r]).count();
        println!("t={t}: means {:?}; M=10000 beats M=1000 in {better}/{reps} paired seeds", means.iter().map(|p| format!("{:.4}", p.1)).collect::<Vec<_>>());
        repeat.push(json!({"t": t, "M": ms, "mean_l1": means.iter().map(|p| p.1).collect::<Vec<_>>(),
                           "min_l1": per_m.iter().map(|d| d.iter().cloned().fold(f64::MAX, f64::min)).collect::<Vec<_>>(),
                           "max_l1": per_m.iter().map(|d| d.iter().cloned().fold(0.0, f64::max)).collect::<Vec<_>>(),
                           "expected_l1": theory.iter().map(|p| p.1).collect::<Vec<_>>(),
                           "pairs_10000_better_than_1000": better, "pairs_not_better": worse_pairs, "reps": reps}));
        series.push((format!("t = {t}: one run per seed"), pts, colors[ci], false));
        series.push((format!("t = {t}: mean of {reps} seeds"), means, colors[ci], true));
    }
    error_chart("HW8_T2_error.svg", "L1 error of endpoint frequencies vs M (weighted walk, 40 seeds per point)", &series, (80.0, 40000.0), (0.001, 0.6));

    let fw1 = &empirical["weighted_10_1000"];
    let fw = &empirical["weighted_10_10000"];
    let fu = &empirical["uniform_10_10000"];
    let vec = |v: &serde_json::Value| v.as_array().unwrap().iter().map(|x| x.as_f64().unwrap()).collect::<Vec<f64>>();
    let ymax = pred_w[10].iter().chain(&pred_u[10]).chain(&vec(fw)).chain(&vec(fu)).cloned().fold(0.0, f64::max) * 1.15;
    bar_panels("HW8_T2_bars.svg", &web.labels, &[
        ("Weighted transitions, t = 10: p0 P^10 vs endpoint frequencies", vec![
            ("predicted p0 P^10".to_string(), pred_w[10].clone(), RGBColor(30, 58, 138)),
            ("M = 1,000 walkers".to_string(), vec(fw1), RGBColor(147, 197, 253)),
            ("M = 10,000 walkers".to_string(), vec(fw), RGBColor(59, 130, 246))]),
        ("Uniform choice among outgoing neighbours, t = 10, same dangling rule", vec![
            ("predicted p0 P_uniform^10".to_string(), pred_u[10].clone(), RGBColor(154, 52, 18)),
            ("M = 10,000 walkers".to_string(), vec(fu), RGBColor(251, 146, 60))]),
    ], ymax);
    let vmax = pred_w[10].iter().chain(&pred_u[10]).cloned().fold(0.0, f64::max);
    graph_values_row("HW8_T2_graphs.svg", &web, &[("Weighted: p0 P^10", pred_w[10].clone()), ("Uniform among neighbours: p0 P^10", pred_u[10].clone())], vmax, false);

    let gain: Vec<f64> = (0..n).map(|i| pred_w[10][i] - pred_u[10][i]).collect();
    let out = json!({
        "start": START, "labels": web.labels, "P_weighted": pw, "P_uniform": pu,
        "rows_sum_to_one": rows_ok, "predicted_are_distributions": vectors_ok,
        "predicted_weighted": pred_w, "predicted_uniform": pred_u, "weighted_minus_uniform_t10": gain,
        "runs": table, "empirical": empirical, "repeats": repeat,
    });
    std::fs::write("HW8_T2_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
}
