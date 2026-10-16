use std::collections::BTreeSet;
use std::fs;

use hw7::draw::{FONT, rgb, tag};
use hw7::{Image, NineTree, Pca, Rect, SplitMix64, load_png};
use plotters::coord::Shift;
use plotters::prelude::*;
use serde_json::{Value, json};

const DEPTH: u32 = 4;
const SEED: u64 = 7;
const PLOT_SEED: u64 = 2026;
const PLOT_SAMPLE: usize = 30_000;

fn sample_ids(candidates: &[usize], count: usize, seed: u64) -> Vec<usize> {
    if candidates.len() <= count {
        return candidates.to_vec();
    }
    let mut rng = SplitMix64(seed);
    let mut chosen = BTreeSet::new();
    while chosen.len() < count {
        chosen.insert(candidates[rng.below(candidates.len() as u64) as usize]);
    }
    chosen.into_iter().collect()
}

fn pca_panel(area: &DrawingArea<BitMapBackend, Shift>, title: &str, axes: (usize, usize), x: (f64, f64), y: (f64, f64),
             points: &[usize], scores: &[[f64; 3]], img: &Image, radius: u32, view: &Value, zoom: bool) {
    let (pa, pb) = axes;
    let mut chart = ChartBuilder::on(area)
        .caption(title, (FONT, 18))
        .margin(10)
        .x_label_area_size(36)
        .y_label_area_size(56)
        .build_cartesian_2d(x.0..x.1, y.0..y.1)
        .unwrap();
    let digits = if zoom { 3 } else { 1 };
    let fmt = move |v: &f64| format!("{:.digits$}", if v.abs() < 1e-9 { 0.0 } else { *v });
    chart.configure_mesh().disable_mesh().x_desc(format!("PC{}", pa + 1)).y_desc(format!("PC{}", pb + 1))
        .x_label_formatter(&fmt).y_label_formatter(&fmt)
        .label_style((FONT, 13)).axis_desc_style((FONT, 15)).draw().unwrap();
    chart.draw_series(points.iter().map(|&i| {
        let c = rgb([img.rgb[3 * i], img.rgb[3 * i + 1], img.rgb[3 * i + 2]]);
        Circle::new((scores[i][pa], scores[i][pb]), radius, c.filled())
    })).unwrap();
    if !zoom {
        let r: Vec<f64> = view["root"].as_array().unwrap().iter().map(|v| v.as_f64().unwrap()).collect();
        chart.draw_series(std::iter::once(Rectangle::new([(r[0], r[1]), (r[2], r[3])],
            ShapeStyle { color: RGBColor(120, 120, 120).to_rgba(), filled: false, stroke_width: 1 }))).unwrap();
    }
    for (rank, t) in view["top"].as_array().unwrap().iter().enumerate() {
        let b: Vec<f64> = t["box"].as_array().unwrap().iter().map(|v| v.as_f64().unwrap()).collect();
        chart.draw_series(std::iter::once(Rectangle::new([(b[0], b[1]), (b[2], b[3])],
            ShapeStyle { color: BLACK.to_rgba(), filled: false, stroke_width: if zoom { 3 } else { 2 } }))).unwrap();
        chart.draw_series(std::iter::once(Rectangle::new([(b[0], b[1]), (b[2], b[3])],
            ShapeStyle { color: WHITE.to_rgba(), filled: false, stroke_width: 1 }))).unwrap();
        if zoom {
            let rep = [0, 1, 2].map(|k| t["rep_rgb"][k].as_u64().unwrap() as u8);
            let p = (t["rep_pc"][0].as_f64().unwrap(), t["rep_pc"][1].as_f64().unwrap());
            let el = EmptyElement::at(p)
                + Circle::new((0, 0), 8, BLACK.filled())
                + Circle::new((0, 0), 6, WHITE.filled())
                + Circle::new((0, 0), 4, rgb(rep).filled());
            chart.draw_series(std::iter::once(el)).unwrap();
            let label = (rank + 1).to_string();
            tag(&mut chart, ((b[0] + b[2]) / 2.0, b[3]), &label, (-(label.len() as i32) * 4 - 4, -24), WHITE, 13);
        }
    }
}

fn equal_ranges(x: (f64, f64), y: (f64, f64), w: f64, h: f64) -> ((f64, f64), (f64, f64)) {
    let (dx, dy) = (x.1 - x.0, y.1 - y.0);
    if dx / w > dy / h {
        let half = dx * h / w / 2.0;
        let c = (y.0 + y.1) / 2.0;
        (x, (c - half, c + half))
    } else {
        let half = dy * w / h / 2.0;
        let c = (x.0 + x.1) / 2.0;
        ((c - half, c + half), y)
    }
}

fn figures(img: &Image, scores: &[[f64; 3]], views: &[Value]) {
    let all: Vec<usize> = (0..img.len()).collect();
    let display = sample_ids(&all, PLOT_SAMPLE, PLOT_SEED);

    let root = BitMapBackend::new("HW7_T2_pca.jpg", (1950, 560)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    for (area, view) in root.split_evenly((1, 3)).iter().zip(views) {
        let (pa, pb) = (view["pair"][0].as_u64().unwrap() as usize - 1, view["pair"][1].as_u64().unwrap() as usize - 1);
        let r: Vec<f64> = view["root"].as_array().unwrap().iter().map(|v| v.as_f64().unwrap()).collect();
        let (px, py) = ((r[2] - r[0]) * 0.04, (r[3] - r[1]) * 0.04);
        let (xr, yr) = equal_ranges((r[0] - px, r[2] + px), (r[1] - py, r[3] + py), 650.0 - 76.0, 560.0 - 80.0);
        let share = 100.0 * view["top_total"].as_f64().unwrap() / view["total"].as_f64().unwrap();
        pca_panel(area, &format!("PC{}-PC{}: top ten depth-4 cells ({share:.1}% of pixels)", pa + 1, pb + 1),
                  (pa, pb), xr, yr, &display, scores, img, 1, view, false);
    }
    root.present().unwrap();

    let root = BitMapBackend::new("HW7_T2_pca_zoom.jpg", (1500, 1650)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    for (area, view) in root.split_evenly((3, 1)).iter().zip(views) {
        let (pa, pb) = (view["pair"][0].as_u64().unwrap() as usize - 1, view["pair"][1].as_u64().unwrap() as usize - 1);
        let boxes: Vec<Vec<f64>> = view["top"].as_array().unwrap().iter()
            .map(|t| t["box"].as_array().unwrap().iter().map(|v| v.as_f64().unwrap()).collect()).collect();
        let x0 = boxes.iter().map(|b| b[0]).fold(f64::INFINITY, f64::min);
        let y0 = boxes.iter().map(|b| b[1]).fold(f64::INFINITY, f64::min);
        let x1 = boxes.iter().map(|b| b[2]).fold(f64::NEG_INFINITY, f64::max);
        let y1 = boxes.iter().map(|b| b[3]).fold(f64::NEG_INFINITY, f64::max);
        let (mx, my) = ((x1 - x0) * 0.12 + 0.01, (y1 - y0) * 0.6 + 0.01);
        let (xr, yr) = ((x0 - mx, x1 + mx), (y0 - my, y1 + my));
        let local: Vec<usize> = (0..img.len())
            .filter(|&i| scores[i][pa] > xr.0 && scores[i][pa] < xr.1 && scores[i][pb] > yr.0 && scores[i][pb] < yr.1).collect();
        let shown = sample_ids(&local, PLOT_SAMPLE, PLOT_SEED);
        pca_panel(area, &format!("PC{}-PC{}: zoom on the top ten cells (number = rank, dot = representative in its own colour; axes not to scale)", pa + 1, pb + 1),
                  (pa, pb), xr, yr, &shown, scores, img, 2, view, true);
    }
    root.present().unwrap();
}

fn main() {
    let a = load_png("HW7_01.png");
    let pca = Pca::fit(&a);
    let n = a.len();
    let scores: Vec<[f64; 3]> = (0..n).map(|i| pca.project([a.rgb[3 * i], a.rgb[3 * i + 1], a.rgb[3 * i + 2]])).collect();

    let mut lo = [f64::INFINITY; 3];
    let mut hi = [f64::NEG_INFINITY; 3];
    for s in &scores {
        for k in 0..3 {
            lo[k] = lo[k].min(s[k]);
            hi[k] = hi[k].max(s[k]);
        }
    }
    let mut padded = Vec::new();
    for k in 0..3 {
        if hi[k] == lo[k] {
            lo[k] -= 0.5;
            hi[k] += 0.5;
            padded.push(k + 1);
        }
        println!("PC{}: [{:.6}, {:.6}]", k + 1, lo[k], hi[k]);
    }
    println!("zero-range axes padded: {padded:?}");

    let side = 3usize.pow(DEPTH);
    let mut rng = SplitMix64(SEED);
    let mut views = Vec::new();
    for (pa, pb) in [(0usize, 1usize), (1, 2), (0, 2)] {
        let root = Rect { xmin: lo[pa], ymin: lo[pb], xmax: hi[pa], ymax: hi[pb] };
        let tree = NineTree::plot(root);
        let cell_of: Vec<usize> = scores.iter().map(|s| {
            let (col, row) = tree.bins((s[pa], s[pb]), DEPTH);
            row * side + col
        }).collect();
        let mut counts = vec![0usize; side * side];
        for &c in &cell_of {
            counts[c] += 1;
        }
        let total: usize = counts.iter().sum();
        assert_eq!(total, n, "counts do not sum to W*H");
        let occupied = counts.iter().filter(|&&c| c > 0).count();

        let mut cells: Vec<(usize, String, usize)> = (0..side * side).filter(|&c| counts[c] > 0)
            .map(|c| (counts[c], NineTree::code_of_bins(c % side, c / side, DEPTH), c)).collect();
        cells.sort_by(|x, y| y.0.cmp(&x.0).then(x.1.cmp(&y.1)));
        let top: Vec<_> = cells.into_iter().take(10).collect();

        println!("\nPC{}-PC{}: {occupied} occupied cells of {}", pa + 1, pb + 1, side * side);
        println!("{:<6} {:>8} {:>44} {:>10} {:>15}", "code", "count", "x1, y1, x2, y2", "rep id", "rep RGB");
        let mut rows = Vec::new();
        let mut top_total = 0;
        for (count, code, cell) in &top {
            let members: Vec<usize> = (0..n).filter(|&i| cell_of[i] == *cell).collect();
            let rep = members[rng.below(*count as u64) as usize];
            let mut sample = BTreeSet::new();
            while sample.len() < 10.min(*count) {
                sample.insert(members[rng.below(*count as u64) as usize]);
            }
            let r = tree.decode(code);
            let p = (scores[rep][pa], scores[rep][pb]);
            assert_eq!(tree.encode(p, DEPTH), *code, "representative outside its cell");
            let rgb = [a.rgb[3 * rep], a.rgb[3 * rep + 1], a.rgb[3 * rep + 2]];
            println!("{code:<6} {count:>8} {:>10.5}, {:>9.5}, {:>9.5}, {:>9.5} {rep:>10} {:>15}",
                     r.xmin, r.ymin, r.xmax, r.ymax, format!("{rgb:?}"));
            top_total += count;
            rows.push(json!({
                "code": code, "count": count, "box": [r.xmin, r.ymin, r.xmax, r.ymax],
                "rep_id": rep, "rep_xy": [rep % a.width, rep / a.width], "rep_rgb": rgb, "rep_pc": [p.0, p.1],
                "sample_rgb": sample.iter().map(|&i| [a.rgb[3 * i], a.rgb[3 * i + 1], a.rgb[3 * i + 2]]).collect::<Vec<_>>(),
            }));
        }
        println!("top ten hold {top_total} pixels = {:.2}% of {n}", 100.0 * top_total as f64 / n as f64);
        views.push(json!({
            "pair": [pa + 1, pb + 1], "root": [root.xmin, root.ymin, root.xmax, root.ymax],
            "occupied": occupied, "total": total, "top_total": top_total, "top": rows,
        }));
    }
    figures(&a, &scores, &views);
    println!("wrote HW7_T2_pca.jpg, HW7_T2_pca_zoom.jpg");
    let out = json!({ "plot_seed": PLOT_SEED, "plot_sample": PLOT_SAMPLE, "depth": DEPTH, "seed": SEED, "rng": "SplitMix64", "bounds": [lo, hi], "padded_axes": padded, "views": views });
    fs::write("HW7_T2_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
    println!("\nwrote HW7_T2_results.json");
}
