use std::fs;

use hw7::draw::equal_ranges;
use hw7::palette::{Assignment, Rep, TIE_EPS, View, assign_by, labels_hash, rep_json, step_figure};
use hw7::{Pca, load_png, sample_ids};
use plotters::prelude::*;
use serde_json::{Value, json};

const PLOT_SEED: u64 = 2026;
const PLOT_SAMPLE: usize = 30_000;

fn is_grey(c: [u8; 3]) -> bool {
    c[0] == c[1] && c[1] == c[2]
}

fn pearson(a: [u8; 3], b: [u8; 3]) -> f64 {
    let fa = a.map(|v| v as f64 / 255.0);
    let fb = b.map(|v| v as f64 / 255.0);
    let ma = (fa[0] + fa[1] + fa[2]) / 3.0;
    let mb = (fb[0] + fb[1] + fb[2]) / 3.0;
    let a0 = fa.map(|v| v - ma);
    let b0 = fb.map(|v| v - mb);
    let dot = a0[0] * b0[0] + a0[1] * b0[1] + a0[2] * b0[2];
    let na = (a0[0] * a0[0] + a0[1] * a0[1] + a0[2] * a0[2]).sqrt();
    let nb = (b0[0] * b0[0] + b0[1] * b0[1] + b0[2] * b0[2]).sqrt();
    (dot / (na * nb)).clamp(-1.0, 1.0)
}

fn correlation_distance(a: [u8; 3], b: [u8; 3]) -> f64 {
    match (is_grey(a), is_grey(b)) {
        (true, true) => 0.0,
        (true, false) | (false, true) => 1.0,
        (false, false) => 1.0 - pearson(a, b),
    }
}

fn changed(a: &Assignment, b: &Assignment) -> usize {
    a.labels.iter().zip(&b.labels).filter(|(x, y)| x != y).count()
}

fn main() {
    let a = load_png("HW7_01.png");
    let n = a.len();
    let px = |i: usize| [a.rgb[3 * i], a.rgb[3 * i + 1], a.rgb[3 * i + 2]];
    let pca = Pca::fit(&a);
    let pc: Vec<(f64, f64)> = (0..n).map(|i| {
        let s = pca.project(px(i));
        (s[0], s[1])
    }).collect();

    let t3: Value = serde_json::from_str(&fs::read_to_string("HW7_T3_results.json").unwrap()).unwrap();
    let kept = t3["kept"].as_str().unwrap();
    let palette = t3["palettes"].as_array().unwrap().iter().find(|p| p["name"] == kept).unwrap();
    let reps: Vec<Rep> = palette["reps"].as_array().unwrap().iter().map(|r| {
        let id = r["id"].as_u64().unwrap() as usize;
        Rep { id, rgb: px(id), pc: pc[id] }
    }).collect();
    assert!(reps.windows(2).all(|w| w[0].id < w[1].id));
    let grey_reps = reps.iter().filter(|r| is_grey(r.rgb)).count();

    let euclid2d = assign_by(&a, &reps, |i, r| (pc[i].0 - r.pc.0).powi(2) + (pc[i].1 - r.pc.1).powi(2));
    assert_eq!(labels_hash(&euclid2d.labels), palette["labels_sha256"].as_str().unwrap(), "T3 labels not reproduced");
    let rgb3d = assign_by(&a, &reps, |i, r| {
        let p = px(i);
        (0..3).map(|c| ((p[c] as f64 - r.rgb[c] as f64) / 255.0).powi(2)).sum()
    });
    let corr = assign_by(&a, &reps, |i, r| correlation_distance(px(i), r.rgb));

    let grey_pixels = (0..n).filter(|&i| is_grey(px(i))).count();
    let grey_labels: Vec<usize> = {
        let mut c = vec![0usize; reps.len()];
        for i in (0..n).filter(|&i| is_grey(px(i))) {
            c[corr.labels[i] as usize] += 1;
        }
        c
    };
    for asg in [&euclid2d, &rgb3d, &corr] {
        assert_eq!(asg.counts.iter().sum::<usize>(), n);
    }
    for (k, r) in reps.iter().enumerate() {
        assert_eq!(corr.labels[r.id] as usize, k, "representative not at correlation distance zero from itself");
        assert!(correlation_distance(r.rgb, r.rgb) < 1e-12);
    }

    let example = pearson([10, 20, 30], [110, 120, 130]);
    println!("r((10,20,30), (110,120,130)) = {example:.15}, d = {:.2e}", 1.0 - example);
    println!("grey pixels: {grey_pixels} ({:.2}%), grey representatives: {grey_reps}, labels of grey pixels: {grey_labels:?}",
             100.0 * grey_pixels as f64 / n as f64);
    println!("correlation tie-broken pixels: {}", corr.ties);
    println!("\n{:<22} {:>12} {:>16} {:>16}", "rule", "mean error", "changed vs 2D", "changed vs 3D");
    for (name, asg) in [("2D PCA Euclidean (T3)", &euclid2d), ("3D RGB Euclidean", &rgb3d), ("RGB correlation", &corr)] {
        println!("{name:<22} {:>12.2} {:>15.2}% {:>15.2}%", asg.error,
                 100.0 * changed(asg, &euclid2d) as f64 / n as f64, 100.0 * changed(asg, &rgb3d) as f64 / n as f64);
        println!("    counts {:?}", asg.counts);
    }

    let t2: Value = serde_json::from_str(&fs::read_to_string("HW7_T2_results.json").unwrap()).unwrap();
    let r: Vec<f64> = t2["views"][0]["root"].as_array().unwrap().iter().map(|v| v.as_f64().unwrap()).collect();
    let (dx, dy) = ((r[2] - r[0]) * 0.04, (r[3] - r[1]) * 0.04);
    let (xr, yr) = equal_ranges((r[0] - dx, r[2] + dx), (r[1] - dy, r[3] + dy), 650.0 - 76.0, 560.0 - 80.0);
    let all: Vec<usize> = (0..n).collect();
    let shown = sample_ids(&all, PLOT_SAMPLE, PLOT_SEED);
    let view = View { x: xr, y: yr, shown: &shown, pc: &pc };
    let root = BitMapBackend::new("HW7_T4_compare.jpg", (1500, 1320)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let rows = root.split_evenly((2, 1));
    step_figure(&rows[0], &a, &view, "T3 final palette: 2D Euclidean distance in PC1-PC2",
                &format!("Image A, 2D Euclidean: mean RGB error {:.1}", euclid2d.error), &reps, &euclid2d);
    step_figure(&rows[1], &a, &view, "Same palette, RGB correlation distance 1 - r",
                &format!("Image A, correlation: mean RGB error {:.1}", corr.error), &reps, &corr);
    root.present().unwrap();
    println!("wrote HW7_T4_compare.jpg");

    let rule = |name: &str, asg: &Assignment| json!({
        "name": name, "counts": asg.counts, "mean_rgb_error": asg.error, "ties": asg.ties,
        "changed_vs_2d": changed(asg, &euclid2d), "changed_vs_3d": changed(asg, &rgb3d),
        "labels_sha256": labels_hash(&asg.labels),
    });
    let out = json!({
        "palette": kept, "tie_eps": TIE_EPS,
        "reps": reps.iter().map(|r| rep_json(r, a.width, 0)).collect::<Vec<_>>(),
        "grey_pixels": grey_pixels, "grey_reps": grey_reps, "grey_labels": grey_labels,
        "example_r": example,
        "rules": [rule("2d", &euclid2d), rule("3d", &rgb3d), rule("corr", &corr)],
    });
    fs::write("HW7_T4_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
    println!("wrote HW7_T4_results.json");
}
