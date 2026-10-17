use std::fs;

use hw7::draw::{FONT, equal_ranges};
use hw7::palette::{Rep, TIE_EPS, View, assign_by, labels_hash, rep_json, step_figure};
use hw7::{NineTree, Pca, Rect, SplitMix64, load_png, sample_ids};
use plotters::prelude::*;
use serde_json::{Value, json};

const DEPTH: u32 = 4;
const PAIR: (usize, usize) = (0, 1);
const CANDIDATE_SEED: u64 = 7;
const PLOT_SEED: u64 = 2026;
const PLOT_SAMPLE: usize = 30_000;

fn main() {
    let a = load_png("HW7_01.png");
    let n = a.len();
    let pca = Pca::fit(&a);
    let scores: Vec<[f64; 3]> = (0..n).map(|i| pca.project([a.rgb[3 * i], a.rgb[3 * i + 1], a.rgb[3 * i + 2]])).collect();
    let pc: Vec<(f64, f64)> = scores.iter().map(|s| (s[PAIR.0], s[PAIR.1])).collect();
    let rep_of = |id: usize| Rep { id, rgb: [a.rgb[3 * id], a.rgb[3 * id + 1], a.rgb[3 * id + 2]], pc: pc[id] };

    let t2: Value = serde_json::from_str(&fs::read_to_string("HW7_T2_results.json").unwrap()).unwrap();
    let view = &t2["views"][0];
    assert_eq!(view["pair"], json!([PAIR.0 + 1, PAIR.1 + 1]));
    let mut initial: Vec<Rep> = view["top"].as_array().unwrap().iter().map(|t| rep_of(t["rep_id"].as_u64().unwrap() as usize)).collect();
    initial.sort_by_key(|r| r.id);

    let r: Vec<f64> = view["root"].as_array().unwrap().iter().map(|v| v.as_f64().unwrap()).collect();
    let tree = NineTree::plot(Rect { xmin: r[0], ymin: r[1], xmax: r[2], ymax: r[3] });
    let side = 3usize.pow(DEPTH);
    let mut members: Vec<Vec<usize>> = vec![Vec::new(); side * side];
    for (i, p) in pc.iter().enumerate() {
        let (col, row) = tree.bins(*p, DEPTH);
        members[row * side + col].push(i);
    }
    let mut cells: Vec<(usize, String, usize)> = (0..side * side).filter(|&c| !members[c].is_empty())
        .map(|c| (members[c].len(), NineTree::code_of_bins(c % side, c / side, DEPTH), c)).collect();
    cells.sort_by(|x, y| y.0.cmp(&x.0).then(x.1.cmp(&y.1)));
    let top_ids: Vec<usize> = view["top"].as_array().unwrap().iter().map(|t| t["rep_id"].as_u64().unwrap() as usize).collect();
    let mut rng = SplitMix64(CANDIDATE_SEED);
    let candidates: Vec<(String, usize)> = cells.iter().enumerate().map(|(rank, (count, code, cell))| {
        let id = if rank < 10 { top_ids[rank] } else { members[*cell][rng.below(*count as u64) as usize] };
        (code.clone(), id)
    }).collect();
    println!("{} occupied PC1-PC2 cells, one fixed candidate pixel per cell", candidates.len());

    let greedy = |delta: f64, limit: usize| -> Vec<(String, usize)> {
        let mut kept: Vec<(String, usize)> = Vec::new();
        for (code, id) in &candidates {
            let p = pc[*id];
            if kept.iter().all(|(_, k)| ((p.0 - pc[*k].0).powi(2) + (p.1 - pc[*k].1).powi(2)).sqrt() >= delta) {
                kept.push((code.clone(), *id));
                if kept.len() == limit {
                    break;
                }
            }
        }
        kept
    };
    let mut search = Vec::new();
    let mut chosen_delta = 0.0;
    println!("\n{:>6} {:>18}", "delta", "kept (uncapped)");
    for step in (1..=30).rev() {
        let delta = step as f64 * 0.02;
        let all = greedy(delta, usize::MAX).len();
        println!("{delta:>6.2} {all:>18}");
        search.push(json!({ "delta": delta, "kept": all }));
        if all >= 10 && chosen_delta == 0.0 {
            chosen_delta = delta;
        }
    }
    let spread_cells = greedy(chosen_delta, 10);
    let mut spread: Vec<Rep> = spread_cells.iter().map(|(_, id)| rep_of(*id)).collect();
    spread.sort_by_key(|r| r.id);
    println!("\nchosen delta = {chosen_delta:.2} (largest value on the grid that still keeps 10 representatives)");

    let dist2 = |p: (f64, f64), q: (f64, f64)| (p.0 - q.0).powi(2) + (p.1 - q.1).powi(2);
    let sequence_palette = |a1: f64, a2: f64| -> (Vec<Rep>, usize) {
        let mut picked: Vec<usize> = Vec::new();
        let mut i = 0usize;
        while picked.len() < 10 {
            let (u, v) = ((0.5 + a1 * i as f64).fract(), (0.5 + a2 * i as f64).fract());
            i += 1;
            let p = (r[0] + u * (r[2] - r[0]), r[1] + v * (r[3] - r[1]));
            let (col, row) = tree.bins(p, DEPTH);
            let cell = &members[row * side + col];
            if cell.is_empty() {
                continue;
            }
            let best = *cell.iter().min_by(|&&x, &&y| dist2(pc[x], p).partial_cmp(&dist2(pc[y], p)).unwrap().then(x.cmp(&y))).unwrap();
            if !picked.contains(&best) {
                picked.push(best);
            }
        }
        let mut reps: Vec<Rep> = picked.into_iter().map(rep_of).collect();
        reps.sort_by_key(|r| r.id);
        (reps, i)
    };
    let phi = (1.0 + 5f64.sqrt()) / 2.0;
    let plastic = 1.324_717_957_244_746_f64;
    let (golden, golden_tried) = sequence_palette(1.0 / phi, 1.0 / (phi * phi));
    let (plastic_reps, plastic_tried) = sequence_palette(1.0 / plastic, 1.0 / (plastic * plastic));
    println!("golden ratio sequence: {golden_tried} points tried; plastic number sequence: {plastic_tried} points tried");

    let palettes: Vec<(&str, &str, &Vec<Rep>)> = vec![
        ("initial", "Step 1: initial palette (T2 top ten of PC1-PC2)", &initial),
        ("golden", "Step 2: golden ratio sequence", &golden),
        ("plastic", "Step 3: plastic number (2D golden ratio) sequence", &plastic_reps),
        ("spread", "Step 4: spread palette (minimum distance delta)", &spread),
    ];
    let mut results = Vec::new();
    let mut assignments = Vec::new();
    for (name, _, reps) in &palettes {
        let asg = assign_by(&a, reps, |i, r| dist2(pc[i], r.pc));
        assert_eq!(asg.counts.iter().sum::<usize>(), n, "class counts do not sum to W*H");
        for r in reps.iter() {
            let same: Vec<usize> = (0..reps.len()).filter(|&j| reps[j].pc == r.pc).collect();
            assert_eq!(asg.labels[r.id] as usize, same[0], "representative is not assigned to itself");
        }
        let mut probe = SplitMix64(99);
        for _ in 0..1000 {
            let i = probe.below(n as u64) as usize;
            let d: Vec<f64> = reps.iter().map(|r| dist2(pc[i], r.pc).sqrt()).collect();
            let m = d.iter().cloned().fold(f64::INFINITY, f64::min);
            assert!((d[asg.labels[i] as usize] - m).abs() < 1e-6, "direct distance check failed");
            assert!(d[..asg.labels[i] as usize].iter().all(|&x| x > m + 1e-9), "tie not broken by smaller ID");
        }
        let empty = asg.counts.iter().filter(|&&c| c == 0).count();
        println!("{name:>8}: mean RGB error {:.2}, empty classes {empty}, tie-broken pixels {}, counts {:?}", asg.error, asg.ties, asg.counts);
        results.push(json!({
            "name": name, "mean_rgb_error": asg.error, "empty_classes": empty, "tie_broken_pixels": asg.ties, "tie_eps": TIE_EPS,
            "reps": reps.iter().zip(&asg.counts).map(|(r, &c)| rep_json(r, a.width, c)).collect::<Vec<_>>(),
            "labels_sha256": labels_hash(&asg.labels),
        }));
        assignments.push(asg);
    }
    let best = (0..palettes.len()).min_by(|&i, &j| assignments[i].error.partial_cmp(&assignments[j].error).unwrap()).unwrap();
    let keep = palettes[best].0;
    println!("palette kept for T4: {keep}");

    let all: Vec<usize> = (0..n).collect();
    let shown = sample_ids(&all, PLOT_SAMPLE, PLOT_SEED);
    let (px, py) = ((r[2] - r[0]) * 0.04, (r[3] - r[1]) * 0.04);
    let (xr, yr) = equal_ranges((r[0] - px, r[2] + px), (r[1] - py, r[3] + py), 650.0 - 76.0, 560.0 - 80.0);
    let view = View { x: xr, y: yr, shown: &shown, pc: &pc };
    for (step, ((name, title, reps), asg)) in palettes.iter().zip(&assignments).enumerate() {
        let file = format!("HW7_T3_step{}.jpg", step + 1);
        let root = BitMapBackend::new(&file, (1500, 660)).into_drawing_area();
        root.fill(&WHITE).unwrap();
        step_figure(&root, &a, &view, title, &format!("Image A with the {name} palette: mean RGB error {:.1}", asg.error), reps, asg);
        root.present().unwrap();
        println!("wrote {file}");
    }

    let root = BitMapBackend::new("HW7_T3_sequences.jpg", (1300, 640)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let sequences = [("Golden ratio: (i/phi, i/phi^2) mod 1", 1.0 / phi, 1.0 / (phi * phi)),
                     ("Plastic number: (i/g, i/g^2) mod 1", 1.0 / plastic, 1.0 / (plastic * plastic))];
    for (area, (title, a1, a2)) in root.split_evenly((1, 2)).iter().zip(sequences) {
        let mut chart = ChartBuilder::on(area).caption(format!("{title}, first 200 points"), (FONT, 19)).margin(14)
            .x_label_area_size(36).y_label_area_size(46).build_cartesian_2d(0.0..1.0, 0.0..1.0).unwrap();
        chart.configure_mesh().disable_mesh().x_desc("u (share of the PC1 range)").y_desc("v (share of the PC2 range)")
            .label_style((FONT, 13)).axis_desc_style((FONT, 14)).draw().unwrap();
        let pts: Vec<(f64, f64)> = (0..200).map(|i| ((0.5 + a1 * i as f64).fract(), (0.5 + a2 * i as f64).fract())).collect();
        chart.draw_series(pts.iter().enumerate().map(|(i, &p)| {
            let c = if i < 15 { RGBColor(220, 38, 38) } else { RGBColor(59, 130, 246) };
            Circle::new(p, if i < 15 { 5 } else { 3 }, c.filled())
        })).unwrap();
        for (i, &p) in pts.iter().take(15).enumerate() {
            chart.draw_series(std::iter::once(Text::new(i.to_string(), p, (FONT, 13)))).unwrap();
        }
    }
    root.present().unwrap();
    println!("wrote HW7_T3_sequences.jpg");

    let out = json!({
        "pair": [PAIR.0 + 1, PAIR.1 + 1], "candidate_seed": CANDIDATE_SEED, "delta_grid": search, "delta": chosen_delta,
        "spread_cells": spread_cells.iter().map(|(code, id)| json!({ "code": code, "id": id })).collect::<Vec<_>>(),
        "sequences": { "golden": { "a": [1.0 / phi, 1.0 / (phi * phi)], "tried": golden_tried },
                       "plastic": { "a": [1.0 / plastic, 1.0 / (plastic * plastic)], "tried": plastic_tried } },
        "palettes": results, "kept": keep, "plot_seed": PLOT_SEED,
    });
    fs::write("HW7_T3_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
    println!("wrote HW7_T3_results.json");
}
