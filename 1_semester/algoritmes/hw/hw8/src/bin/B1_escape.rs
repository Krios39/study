use plotters::prelude::RGBColor;
use serde_json::json;

use hw8::draw::bar_panels;
use hw8::*;

const DATA: &str = "HW8_graph_data.json";
const RHO: f64 = 0.10;
const TOL: f64 = 1e-12;

fn personalised(g: &Graph, v: &[f64]) -> Vec<f64> {
    let n = g.n();
    let mut p = transition(g, true);
    for i in 0..n {
        if !g.edges.iter().any(|e| e.0 == i) {
            p[i] = v.to_vec();
        }
    }
    let mut x = v.to_vec();
    loop {
        let y: Vec<f64> = vector_step(&x, &p).iter().zip(v).map(|(&a, &b)| (1.0 - RHO) * a + RHO * b).collect();
        let d = l1(&x, &y);
        x = y;
        if d < TOL {
            return x;
        }
    }
}

fn hitting_times(p: &[Vec<f64>], target: &[usize]) -> Vec<f64> {
    let rest: Vec<usize> = (0..p.len()).filter(|i| !target.contains(i)).collect();
    let m = rest.len();
    let mut a: Vec<Vec<f64>> = (0..m).map(|r| {
        let mut row: Vec<f64> = (0..m).map(|c| if r == c { 1.0 } else { 0.0 } - p[rest[r]][rest[c]]).collect();
        row.push(1.0);
        row
    }).collect();
    for c in 0..m {
        let piv = (c..m).max_by(|&x, &y| a[x][c].abs().total_cmp(&a[y][c].abs())).unwrap();
        a.swap(c, piv);
        for r in 0..m {
            if r != c {
                let f = a[r][c] / a[c][c];
                for k in c..=m {
                    a[r][k] -= f * a[c][k];
                }
            }
        }
    }
    let mut h = vec![0.0; p.len()];
    for (r, &i) in rest.iter().enumerate() {
        h[i] = a[r][m] / a[r][r];
    }
    h
}

fn main() {
    let web = Graph::load(DATA, "web_base");
    let n = web.n();
    let on = |set: &[usize]| (0..n).map(|i| if set.contains(&i) { 1.0 / set.len() as f64 } else { 0.0 }).collect::<Vec<f64>>();
    let prefs = [("uniform", vec![1.0 / n as f64; n]), ("teaching", on(&[2, 3, 4])), ("research", on(&[5, 6, 7]))];
    let base: Vec<Vec<f64>> = prefs.iter().map(|(_, v)| personalised(&web, v)).collect();
    let trap = |x: &[f64]| x[9] + x[10];
    let mut candidates = Vec::new();
    for from in [9usize, 10] {
        for to in 0..n {
            if to == from || web.edges.iter().any(|e| e.0 == from && e.1 == to) {
                continue;
            }
            let mut g = web.clone();
            g.edges.push((from, to, 1.0));
            let runs: Vec<Vec<f64>> = prefs.iter().map(|(_, v)| personalised(&g, v)).collect();
            candidates.push((from, to, runs));
        }
    }
    let mut rows = Vec::new();
    for (from, to, runs) in &candidates {
        let masses: Vec<f64> = runs.iter().map(|x| trap(x)).collect();
        let tops: Vec<usize> = runs.iter().map(|x| top_k(x, 1)[0]).collect();
        rows.push(json!({"from": from, "to": to, "edge": format!("{} -> {}", web.labels[*from], web.labels[*to]),
                         "trap_mass": masses, "top_page": tops, "vectors": runs}));
    }
    for (k, (name, _)) in prefs.iter().enumerate() {
        let mut order: Vec<usize> = (0..candidates.len()).collect();
        order.sort_by(|&a, &b| trap(&candidates[a].2[k]).total_cmp(&trap(&candidates[b].2[k])));
        let best = &candidates[order[0]];
        let worst = &candidates[order[order.len() - 1]];
        println!("{name}: baseline trap {:.4}; best {} -> {} trap {:.4} (top {}); worst {} -> {} trap {:.4}", trap(&base[k]),
                 web.labels[best.0], web.labels[best.1], trap(&best.2[k]), web.labels[top_k(&best.2[k], 1)[0]],
                 web.labels[worst.0], web.labels[worst.1], trap(&worst.2[k]));
    }
    let hit = hitting_times(&transition(&web, true), &[9, 10]);
    println!("expected steps to reach the trap without teleportation: {:?}", (0..n).map(|i| format!("{} {:.2}", web.labels[i], hit[i])).collect::<Vec<_>>());
    let targets: Vec<String> = (0..n).map(|j| web.labels[j].clone()).collect();
    let series = |k: usize, from: usize| -> Vec<f64> {
        (0..n).map(|j| candidates.iter().find(|c| c.0 == from && c.1 == j).map(|c| trap(&c.2[k])).unwrap_or(0.0)).collect()
    };
    let panels: Vec<(String, Vec<(String, Vec<f64>, RGBColor)>)> = prefs.iter().enumerate().map(|(k, (name, _))| (
        format!("Teleport {name}: trap mass after adding one link (baseline without link {:.3}, lower is better)", trap(&base[k])),
        vec![("new link from 9 Partner A".to_string(), series(k, 9), RGBColor(37, 99, 235)),
             ("new link from 10 Partner B".to_string(), series(k, 10), RGBColor(234, 88, 12))])).collect();
    let refs: Vec<(&str, Vec<(String, Vec<f64>, RGBColor)>)> = panels.iter().map(|(t, s)| (t.as_str(), s.clone())).collect();
    let ymax = candidates.iter().flat_map(|c| c.2.iter().map(|x| trap(x))).fold(0.0, f64::max) * 1.25;
    bar_panels("HW8_B1_escape.svg", &targets, &refs, ymax);
    std::fs::write("HW8_B1_escape.json", serde_json::to_string_pretty(&json!({
        "rho": RHO, "weight_of_new_link": 1.0, "preferences": prefs.iter().map(|p| p.0).collect::<Vec<_>>(),
        "hitting_time_to_trap": hit, "baseline_trap": base.iter().map(|x| trap(x)).collect::<Vec<_>>(), "baseline_vectors": base, "candidates": rows,
    })).unwrap()).unwrap();
}
