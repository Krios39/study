use plotters::prelude::RGBColor;
use serde_json::json;

use hw8::draw::{bar_panels, graph_values_row, line_chart};
use hw8::*;

const DATA: &str = "HW8_graph_data.json";
const TOL: f64 = 1e-10;
const MAX_ITER: usize = 2000;
const START: usize = 9;
const BURN: usize = 1000;
const COUNT: usize = 100_000;
const WALK_SEED: u64 = 20261003;

fn main() {
    let web = Graph::load(DATA, "web_base");
    let n = web.n();
    let p = transition(&web, true);
    let mut e9 = vec![0.0; n];
    e9[START] = 1.0;

    let rhos = [0.0, 0.05, 0.10, 0.20];
    let colors = [RGBColor(100, 116, 139), RGBColor(37, 99, 235), RGBColor(22, 163, 74), RGBColor(220, 38, 38)];
    let mut results = Vec::new();
    let mut series = Vec::new();
    let mut ranks = Vec::new();
    for (k, &rho) in rhos.iter().enumerate() {
        let pr = pagerank(&p, rho, &e9, TOL, MAX_ITER, 7);
        let top = top_k(&pr.vector, 5);
        let last = *pr.diffs.last().unwrap();
        println!("rho={rho:.2}: converged {} after {} iterations, last L1 step {:.3e}, top5 {:?}", pr.converged, pr.iterations, last,
                 top.iter().map(|&i| format!("{} {:.4}", web.labels[i], pr.vector[i])).collect::<Vec<_>>());
        series.push((format!("rho = {rho:.2}"), pr.diffs.iter().enumerate().take(500).map(|(i, &d)| ((i + 1) as f64, d)).collect(), colors[k]));
        results.push(json!({"rho": rho, "converged": pr.converged, "iterations": pr.iterations, "last_step_l1": last,
                            "vector": pr.vector, "top5": top, "trap_mass": pr.vector[9] + pr.vector[10],
                            "first_distributions": pr.history, "first_diffs": pr.diffs.iter().take(12).collect::<Vec<_>>()}));
        ranks.push(pr.vector);
    }
    line_chart("HW8_T3_convergence.svg", "L1 change between successive vectors, start at Partner A", &series,
               (0.0, 480.0), (1e-12, 5.0), ("iteration", "||p_k+1 - p_k||_1 (log scale)"));

    let rho = 0.10;
    let pr10 = &ranks[2];
    let sampler = Sampler::new(&p);
    let mut rng = SplitMix64(WALK_SEED);
    let visits = long_walk(&sampler, n, rho, START, BURN, COUNT, &mut rng);
    let freq: Vec<f64> = visits.iter().map(|&c| c as f64 / COUNT as f64).collect();
    let walk_l1 = l1(&freq, pr10);
    let extra: Vec<f64> = (1..=20u64).map(|r| {
        let mut rng = SplitMix64(WALK_SEED + 1000 * r);
        let v = long_walk(&sampler, n, rho, START, BURN, COUNT, &mut rng);
        l1(&v.iter().map(|&c| c as f64 / COUNT as f64).collect::<Vec<_>>(), pr10)
    }).collect();
    let iid: f64 = pr10.iter().map(|&x| (2.0 * x * (1.0 - x) / (std::f64::consts::PI * COUNT as f64)).sqrt()).sum();
    println!("long walk rho=0.10 seed {WALK_SEED}: L1 = {walk_l1:.5}; 20 more seeds mean {:.5}; independent-sample estimate {iid:.5}",
             extra.iter().sum::<f64>() / 20.0);

    let vmax = pr10.iter().cloned().fold(0.0, f64::max);
    graph_values_row("HW8_T3_web.svg", &web, &[("PageRank, rho = 0.10 (weighted P, uniform dangling row)", pr10.clone())], vmax, true);
    bar_panels("HW8_T3_walk.svg", &web.labels, &[
        ("rho = 0.10: stationary vector vs visit frequencies of one long walk", vec![
            ("matrix iteration".to_string(), pr10.clone(), RGBColor(30, 58, 138)),
            (format!("long walk: {COUNT} visits after {BURN} discarded"), freq.clone(), RGBColor(96, 165, 250))]),
        ("Effect of rho on the stationary vector (start at Partner A, iterated to convergence)", vec![
            ("rho = 0.05".to_string(), ranks[1].clone(), colors[1]),
            ("rho = 0.10".to_string(), ranks[2].clone(), colors[2]),
            ("rho = 0.20".to_string(), ranks[3].clone(), colors[3])]),
    ], ranks[1].iter().cloned().fold(0.0, f64::max) * 1.2);

    let big = Graph::load(DATA, "clusters_256");
    let pb = transition(&big, true);
    let dangling = (0..big.n()).filter(|&i| !big.edges.iter().any(|e| e.0 == i)).count();
    let uniform = vec![1.0 / big.n() as f64; big.n()];
    let prb = pagerank(&pb, rho, &uniform, TOL, MAX_ITER, 1);
    let topb = top_k(&prb.vector, 5);
    let groups: Vec<f64> = (0..4).map(|g| (0..big.n()).filter(|&i| big.group[i] == g).map(|i| prb.vector[i]).sum()).collect();
    let inter: Vec<(usize, usize)> = big.edges.iter().filter(|e| big.group[e.0] != big.group[e.1]).map(|e| (big.group[e.0] as usize, big.group[e.1] as usize)).collect();
    let mut inter_counts = vec![vec![0usize; 4]; 4];
    inter.iter().for_each(|&(a, b)| inter_counts[a][b] += 1);
    let indeg: Vec<f64> = (0..big.n()).map(|i| big.edges.iter().filter(|e| e.1 == i).map(|e| e.2).sum()).collect();
    println!("clusters_256: converged {} after {}, dangling {dangling}, top5 {:?}, group mass {:?}, inter-group edges {:?}",
             prb.converged, prb.iterations, topb.iter().map(|&i| (i, big.group[i], prb.vector[i])).collect::<Vec<_>>(), groups, inter_counts);

    let out = json!({
        "start": START, "labels": web.labels, "tol": TOL, "max_iter": MAX_ITER, "results": results,
        "walk": {"rho": rho, "seed": WALK_SEED, "burn": BURN, "count": COUNT, "visits": visits, "frequencies": freq, "l1": walk_l1,
                 "extra_seeds_l1": extra, "independent_estimate": iid},
        "clusters": {"n": big.n(), "rho": rho, "start": "uniform", "converged": prb.converged, "iterations": prb.iterations,
                     "dangling": dangling, "vector": prb.vector, "top5": topb, "top5_group": topb.iter().map(|&i| big.group[i]).collect::<Vec<_>>(),
                     "top5_weighted_indegree": topb.iter().map(|&i| indeg[i]).collect::<Vec<_>>(),
                     "group_mass": groups, "inter_group_edges": inter_counts},
    });
    std::fs::write("HW8_T3_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
}
