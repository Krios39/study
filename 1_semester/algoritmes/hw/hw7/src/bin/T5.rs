use std::fs;

use hw7::draw::{FONT, draw_pixels, equal_ranges, image_chart, rgb, tag};
use hw7::{Image, Pca, SplitMix64, load_png, sample_ids, strip_count, strip_vector, strip_xy};
use plotters::prelude::*;
use serde_json::{Value, json};

const SEED: u64 = 7;
const PLOT_SEED: u64 = 2026;
const PLOT_SAMPLE: usize = 30_000;

fn unit(mut v: Vec<f64>) -> Vec<f64> {
    let norm = v.iter().map(|x| x * x).sum::<f64>().sqrt();
    v.iter_mut().for_each(|x| *x /= norm);
    v
}

fn sides(proj: &[f64], t: f64) -> [usize; 3] {
    let mut c = [0usize; 3];
    for &s in proj {
        c[if s < t { 0 } else if s == t { 1 } else { 2 }] += 1;
    }
    c
}

struct Split {
    order: Vec<usize>,
    cut: usize,
    median: f64,
}

fn split(proj: &[f64]) -> Split {
    let mut order: Vec<usize> = (0..proj.len()).collect();
    order.sort_by(|&a, &b| proj[a].partial_cmp(&proj[b]).unwrap().then(a.cmp(&b)));
    let n = proj.len();
    let median = if n % 2 == 1 { proj[order[n / 2]] } else { (proj[order[n / 2 - 1]] + proj[order[n / 2]]) / 2.0 };
    Split { order, cut: n / 2, median }
}

fn summary(name: &str, proj: &[f64], w: &[f64], anchor: usize, sp: &Split) -> Value {
    let t0 = proj[anchor];
    let before = sides(proj, t0);
    let after = sides(proj, sp.median);
    let low_max = proj[sp.order[sp.cut - 1]];
    let high_min = proj[sp.order[sp.cut]];
    let boundary_low = sp.order[..sp.cut].iter().filter(|&&i| proj[i] == high_min).count();
    let boundary_high = sp.order[sp.cut..].iter().filter(|&&i| proj[i] == low_max).count();
    println!("\n=== {name} ===");
    println!("w = {w:?}");
    println!("anchor ID {anchor}, t0 = {t0:.12}");
    println!("t0:     {} below, {} on, {} above", before[0], before[1], before[2]);
    println!("median: t = {:.12}: {} below, {} on, {} above", sp.median, after[0], after[1], after[2]);
    println!("balanced groups: {} + {}, last low = {low_max:.12}, first high = {high_min:.12}", sp.cut, proj.len() - sp.cut);
    println!("records equal to the boundary value split into: low {boundary_low}, high {boundary_high}");
    let (mut distinct, mut longest, mut run, mut longest_value) = (0usize, 0usize, 0usize, 0.0);
    for k in 0..sp.order.len() {
        if k == 0 || proj[sp.order[k]] != proj[sp.order[k - 1]] {
            distinct += 1;
            run = 0;
        }
        run += 1;
        if run > longest {
            longest = run;
            longest_value = proj[sp.order[k]];
        }
    }
    println!("distinct projection values: {distinct} of {}; largest group of identical projections: {longest} at s = {longest_value:.6}", proj.len());
    json!({
        "w": w, "anchor": anchor, "t0": t0, "before": before, "median": sp.median, "after": after,
        "group_low": sp.cut, "group_high": proj.len() - sp.cut, "low_max": low_max, "high_min": high_min,
        "boundary_in_low": boundary_low, "boundary_in_high": boundary_high,
        "last_low_id": sp.order[sp.cut - 1], "first_high_id": sp.order[sp.cut],
        "distinct": distinct, "largest_tie": longest, "largest_tie_value": longest_value,
    })
}

fn part_a(a: &Image, pc: &[(f64, f64)], root: &[f64]) -> Value {
    let mut rng = SplitMix64(SEED);
    let w = unit(rng.normals(2));
    let anchor = rng.below(pc.len() as u64) as usize;
    let proj: Vec<f64> = pc.iter().map(|p| w[0] * p.0 + w[1] * p.1).collect();
    let sp = split(&proj);
    let mut out = summary("A: line in PC1-PC2", &proj, &w, anchor, &sp);
    out["anchor_pc"] = json!([pc[anchor].0, pc[anchor].1]);

    let all: Vec<usize> = (0..pc.len()).collect();
    let shown = sample_ids(&all, PLOT_SAMPLE, PLOT_SEED);
    let (dx, dy) = ((root[2] - root[0]) * 0.04, (root[3] - root[1]) * 0.04);
    let (xr, yr) = equal_ranges((root[0] - dx, root[2] + dx), (root[1] - dy, root[3] + dy), 1000.0 - 80.0, 860.0 - 110.0);
    let area = BitMapBackend::new("HW7_T5_2d.jpg", (1000, 860)).into_drawing_area();
    area.fill(&WHITE).unwrap();
    let mut chart = ChartBuilder::on(&area)
        .caption(format!("Random line in PC1-PC2 (seed {SEED}): dashed = through the anchor, solid = median"), (FONT, 18))
        .margin(12).x_label_area_size(36).y_label_area_size(56)
        .build_cartesian_2d(xr.0..xr.1, yr.0..yr.1).unwrap();
    let fmt = |v: &f64| format!("{:.1}", if v.abs() < 1e-9 { 0.0 } else { *v });
    chart.configure_mesh().disable_mesh().x_desc("PC1").y_desc("PC2").x_label_formatter(&fmt).y_label_formatter(&fmt)
        .label_style((FONT, 13)).axis_desc_style((FONT, 15)).draw().unwrap();
    chart.draw_series(shown.iter().map(|&i| Circle::new(pc[i], 1, rgb([a.rgb[3 * i], a.rgb[3 * i + 1], a.rgb[3 * i + 2]]).filled()))).unwrap();
    let dir = (-w[1], w[0]);
    let line = |t: f64| {
        let base = (t * w[0], t * w[1]);
        let (mut lo, mut hi) = (f64::NEG_INFINITY, f64::INFINITY);
        for (b, d, min, max) in [(base.0, dir.0, xr.0, xr.1), (base.1, dir.1, yr.0, yr.1)] {
            if d.abs() > 1e-12 {
                let (l1, l2) = ((min - b) / d, (max - b) / d);
                lo = lo.max(l1.min(l2));
                hi = hi.min(l1.max(l2));
            }
        }
        [(base.0 + lo * dir.0, base.1 + lo * dir.1), (base.0 + hi * dir.0, base.1 + hi * dir.1)]
    };
    let [p, q] = line(proj[anchor]);
    let steps = 120;
    chart.draw_series((0..steps).step_by(2).map(|k| {
        let f0 = k as f64 / steps as f64;
        let f1 = (k + 1) as f64 / steps as f64;
        PathElement::new(vec![(p.0 + (q.0 - p.0) * f0, p.1 + (q.1 - p.1) * f0), (p.0 + (q.0 - p.0) * f1, p.1 + (q.1 - p.1) * f1)],
                         ShapeStyle { color: RGBColor(220, 38, 38).to_rgba(), filled: false, stroke_width: 3 })
    })).unwrap();
    chart.draw_series(std::iter::once(PathElement::new(line(sp.median).to_vec(),
        ShapeStyle { color: BLACK.to_rgba(), filled: false, stroke_width: 3 }))).unwrap();
    let p0 = pc[anchor];
    let tip = (p0.0 + 0.12 * w[0], p0.1 + 0.12 * w[1]);
    chart.draw_series(std::iter::once(PathElement::new(vec![p0, tip], ShapeStyle { color: RGBColor(37, 99, 235).to_rgba(), filled: false, stroke_width: 3 }))).unwrap();
    chart.draw_series(std::iter::once(EmptyElement::at(tip) + Circle::new((0, 0), 5, RGBColor(37, 99, 235).filled()))).unwrap();
    chart.draw_series(std::iter::once(EmptyElement::at(p0) + Circle::new((0, 0), 8, BLACK.filled()) + Circle::new((0, 0), 5, WHITE.filled()))).unwrap();
    tag(&mut chart, p0, "anchor p0", (-96, 8), WHITE, 13);
    tag(&mut chart, tip, "w", (-6, -30), WHITE, 13);
    area.present().unwrap();
    out
}

fn part_b(a: &Image) -> Value {
    let n = strip_count(a);
    let mut rng = SplitMix64(SEED);
    let w = unit(rng.normals(15));
    let anchor = rng.below(n as u64) as usize;
    let mut proj = vec![0.0; n];
    for (j, s) in proj.iter_mut().enumerate() {
        let v = strip_vector(a, j);
        *s = (0..15).map(|k| w[k] * v[k]).sum();
    }
    let sp = split(&proj);
    let mut out = summary("B: hyperplane in 15D strips", &proj, &w, anchor, &sp);
    let low = sp.order[rng.below(sp.cut as u64) as usize];
    let high = sp.order[sp.cut + rng.below((n - sp.cut) as u64) as usize];
    let strip_json = |id: usize| {
        let (x, y) = strip_xy(a, id);
        json!({ "id": id, "x": x, "y": y, "projection": proj[id], "rgb": (0..5).map(|k| a.pixel(x + k, y)).collect::<Vec<_>>() })
    };
    out["examples"] = json!({ "low": strip_json(low), "high": strip_json(high) });
    out["count"] = json!(n);

    let lo = proj.iter().cloned().fold(f64::INFINITY, f64::min);
    let hi = proj.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let bins = 150;
    let mut hist = vec![0usize; bins];
    for &s in &proj {
        hist[(((s - lo) / (hi - lo) * bins as f64) as usize).min(bins - 1)] += 1;
    }
    let top = *hist.iter().max().unwrap() as f64 * 1.08;
    let area = BitMapBackend::new("HW7_T5_15d_hist.jpg", (1300, 560)).into_drawing_area();
    area.fill(&WHITE).unwrap();
    let mut chart = ChartBuilder::on(&area)
        .caption(format!("Projections s = w·x of all {n} strips (15D, seed {SEED}); red = t0 (anchor), black = median"), (FONT, 18))
        .margin(12).x_label_area_size(40).y_label_area_size(70)
        .build_cartesian_2d(lo..hi, 0.0..top).unwrap();
    let count_fmt = |v: &f64| format!("{v:.0}");
    chart.configure_mesh().disable_mesh().x_desc("projection s").y_desc("strips per bin").y_label_formatter(&count_fmt)
        .label_style((FONT, 13)).axis_desc_style((FONT, 15)).draw().unwrap();
    let width = (hi - lo) / bins as f64;
    chart.draw_series(hist.iter().enumerate().map(|(k, &c)| {
        let x0 = lo + k as f64 * width;
        Rectangle::new([(x0, 0.0), (x0 + width * 0.92, c as f64)], RGBColor(148, 163, 184).filled())
    })).unwrap();
    for (t, color) in [(proj[anchor], RGBColor(220, 38, 38)), (sp.median, BLACK)] {
        chart.draw_series(std::iter::once(PathElement::new(vec![(t, 0.0), (t, top)], ShapeStyle { color: color.to_rgba(), filled: false, stroke_width: 3 }))).unwrap();
    }
    area.present().unwrap();

    let area = BitMapBackend::new("HW7_T5_15d_strips.jpg", (1500, 620)).into_drawing_area();
    area.fill(&WHITE).unwrap();
    let (left, right) = area.split_horizontally(880);
    let (w_img, h_img) = (a.width as f64, a.height as f64);
    let mut chart = image_chart(&left, "Locations of the two example strips on image A", (0.0, w_img), (0.0, h_img));
    draw_pixels(&mut chart, a, (0.0, w_img), (0.0, h_img), 2);
    for (label, id) in [("low group", low), ("high group", high)] {
        let (x, y) = strip_xy(a, id);
        let el = EmptyElement::at((x as f64 + 2.5, y as f64 + 0.5))
            + Rectangle::new([(-16, -9), (16, 9)], ShapeStyle { color: BLACK.to_rgba(), filled: false, stroke_width: 4 })
            + Rectangle::new([(-16, -9), (16, 9)], ShapeStyle { color: WHITE.to_rgba(), filled: false, stroke_width: 2 });
        chart.draw_series(std::iter::once(el)).unwrap();
        tag(&mut chart, (x as f64 + 2.5, y as f64 + 0.5), &format!("{label}: strip {id}"), (20, -12), WHITE, 13);
    }
    for (row, (label, id)) in [("Low group (sorted first half)", low), ("High group (sorted second half)", high)].iter().enumerate() {
        let (x, y) = strip_xy(a, *id);
        let y0 = 40 + row as i32 * 280;
        right.draw(&Text::new(label.to_string(), (20, y0), (FONT, 18))).unwrap();
        right.draw(&Text::new(format!("strip ID {id}, start (x={x}, y={y}), s = {:.4}", proj[*id]), (20, y0 + 26), (FONT, 15))).unwrap();
        for k in 0..5 {
            let c = a.pixel(x + k, y);
            let x0 = 20 + k as i32 * 115;
            right.draw(&Rectangle::new([(x0, y0 + 56), (x0 + 105, y0 + 196)], rgb(c).filled())).unwrap();
            right.draw(&Rectangle::new([(x0, y0 + 56), (x0 + 105, y0 + 196)], ShapeStyle { color: BLACK.to_rgba(), filled: false, stroke_width: 1 })).unwrap();
            right.draw(&Text::new(format!("{},{},{}", c[0], c[1], c[2]), (x0 + 4, y0 + 204), (FONT, 13))).unwrap();
        }
    }
    area.present().unwrap();
    out
}

fn main() {
    let a = load_png("HW7_01.png");
    let pca = Pca::fit(&a);
    let pc: Vec<(f64, f64)> = (0..a.len()).map(|i| {
        let s = pca.project([a.rgb[3 * i], a.rgb[3 * i + 1], a.rgb[3 * i + 2]]);
        (s[0], s[1])
    }).collect();
    let t2: Value = serde_json::from_str(&fs::read_to_string("HW7_T2_results.json").unwrap()).unwrap();
    let root: Vec<f64> = t2["views"][0]["root"].as_array().unwrap().iter().map(|v| v.as_f64().unwrap()).collect();
    let part_a = part_a(&a, &pc, &root);
    let part_b = part_b(&a);
    let out = json!({ "seed": SEED, "rng": "SplitMix64 + Box-Muller", "a": part_a, "b": part_b });
    fs::write("HW7_T5_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
    println!("\nwrote HW7_T5_2d.jpg, HW7_T5_15d_hist.jpg, HW7_T5_15d_strips.jpg, HW7_T5_results.json");
}
