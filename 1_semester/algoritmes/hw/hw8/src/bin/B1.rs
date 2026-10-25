use plotters::prelude::RGBColor;
use serde_json::json;

use hw8::draw::{bar_panels, graph_values_row};
use hw8::*;

const DATA: &str = "HW8_graph_data.json";
const RHO: f64 = 0.10;
const TOL: f64 = 1e-12;
const MAX_ITER: usize = 10_000;

fn personalised(g: &Graph, v: &[f64]) -> (Vec<f64>, usize, bool) {
    let n = g.n();
    let mut p = transition(g, true);
    for i in 0..n {
        if !g.edges.iter().any(|e| e.0 == i) {
            p[i] = v.to_vec();
        }
    }
    let mut x = v.to_vec();
    for k in 1..=MAX_ITER {
        let step = vector_step(&x, &p);
        let y: Vec<f64> = step.iter().zip(v).map(|(&a, &b)| (1.0 - RHO) * a + RHO * b).collect();
        let d = l1(&x, &y);
        x = y;
        if d < TOL {
            return (x, k, true);
        }
    }
    (x, MAX_ITER, false)
}

fn main() {
    let web = Graph::load(DATA, "web_base");
    let n = web.n();
    let on = |set: &[usize]| (0..n).map(|i| if set.contains(&i) { 1.0 / set.len() as f64 } else { 0.0 }).collect::<Vec<f64>>();
    let prefs = [
        ("uniform", "uniform over all 12 pages", vec![1.0 / n as f64; n]),
        ("teaching", "teaching pages 2, 3, 4", on(&[2, 3, 4])),
        ("research", "research pages 5, 6, 7", on(&[5, 6, 7])),
    ];
    let group_names = ["Home", "courses 1-4", "research 5-8", "partners 9-10", "Exit"];
    let mut out = Vec::new();
    let mut vectors = Vec::new();
    for (key, desc, v) in &prefs {
        let (x, iters, ok) = personalised(&web, v);
        let top = top_k(&x, 5);
        let mass: Vec<f64> = (0..5).map(|gi| (0..n).filter(|&i| web.group[i] == gi as i64).map(|i| x[i]).sum()).collect();
        println!("{key}: converged {ok} in {iters}; top5 {:?}; group mass {:?}", top.iter().map(|&i| format!("{} {:.4}", web.labels[i], x[i])).collect::<Vec<_>>(),
                 mass.iter().map(|m| format!("{m:.4}")).collect::<Vec<_>>());
        out.push(json!({"key": key, "description": desc, "preference": v, "vector": x, "iterations": iters, "converged": ok,
                        "top5": top, "group_mass": mass}));
        vectors.push(x);
    }
    let vmax = vectors.iter().flatten().cloned().fold(0.0, f64::max);
    graph_values_row("HW8_B1_graphs.svg", &web, &[
        ("Uniform teleportation", vectors[0].clone()),
        ("Teleport to teaching pages 2, 3, 4", vectors[1].clone()),
        ("Teleport to research pages 5, 6, 7", vectors[2].clone()),
    ], vmax, false);
    let names: Vec<String> = group_names.iter().map(|s| s.to_string()).collect();
    let mass = |k: usize| out[k]["group_mass"].as_array().unwrap().iter().map(|x| x.as_f64().unwrap()).collect::<Vec<f64>>();
    bar_panels("HW8_B1_groups.svg", &names, &[
        ("Probability mass per page group, rho = 0.10", vec![
            ("uniform".to_string(), mass(0), RGBColor(100, 116, 139)),
            ("teaching 2, 3, 4".to_string(), mass(1), RGBColor(37, 99, 235)),
            ("research 5, 6, 7".to_string(), mass(2), RGBColor(22, 163, 74))]),
    ], mass(0).iter().chain(&mass(1)).chain(&mass(2)).cloned().fold(0.0, f64::max) * 1.2);
    std::fs::write("HW8_B1_results.json", serde_json::to_string_pretty(&json!({
        "rho": RHO, "tol": TOL, "labels": web.labels, "groups": group_names, "runs": out,
    })).unwrap()).unwrap();
}
