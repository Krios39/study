use plotters::prelude::*;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::Image;
use crate::draw::{FONT, draw_pixels, image_chart, rgb, tag};

pub const TIE_EPS: f64 = 1e-12;

#[derive(Clone)]
pub struct Rep {
    pub id: usize,
    pub rgb: [u8; 3],
    pub pc: (f64, f64),
}

pub struct Assignment {
    pub labels: Vec<u8>,
    pub counts: Vec<usize>,
    pub error: f64,
    pub ties: usize,
}

pub fn assign_by(img: &Image, reps: &[Rep], dist: impl Fn(usize, &Rep) -> f64) -> Assignment {
    let mut labels = vec![0u8; img.len()];
    let mut counts = vec![0usize; reps.len()];
    let mut error = 0.0;
    let mut ties = 0;
    let mut d = vec![0.0; reps.len()];
    for i in 0..img.len() {
        for (k, r) in reps.iter().enumerate() {
            d[k] = dist(i, r);
        }
        let m = d.iter().cloned().fold(f64::INFINITY, f64::min);
        let best = (0..d.len()).find(|&k| d[k] <= m + TIE_EPS).unwrap();
        ties += ((best + 1)..d.len()).any(|k| d[k] <= m + TIE_EPS) as usize;
        labels[i] = best as u8;
        counts[best] += 1;
        let o = [img.rgb[3 * i], img.rgb[3 * i + 1], img.rgb[3 * i + 2]];
        error += (0..3).map(|c| (o[c] as f64 - reps[best].rgb[c] as f64).powi(2)).sum::<f64>().sqrt();
    }
    Assignment { labels, counts, error: error / img.len() as f64, ties }
}

pub fn reconstruct(img: &Image, labels: &[u8], reps: &[Rep]) -> Image {
    let rgb = labels.iter().flat_map(|&l| reps[l as usize].rgb).collect();
    Image { width: img.width, height: img.height, rgb }
}

pub fn labels_hash(labels: &[u8]) -> String {
    Sha256::digest(labels).iter().map(|b| format!("{b:02x}")).collect()
}

pub fn rep_json(r: &Rep, w: usize, count: usize) -> Value {
    json!({ "id": r.id, "xy": [r.id % w, r.id / w], "rgb": r.rgb, "pc": [r.pc.0, r.pc.1], "count": count })
}

pub fn pca_view(area: &DrawingArea<BitMapBackend, plotters::coord::Shift>, title: &str, x: (f64, f64), y: (f64, f64),
                shown: &[usize], pc: &[(f64, f64)], labels: &[u8], reps: &[Rep]) {
    let mut chart = ChartBuilder::on(area)
        .caption(title, (FONT, 18))
        .margin(10)
        .x_label_area_size(36)
        .y_label_area_size(56)
        .build_cartesian_2d(x.0..x.1, y.0..y.1)
        .unwrap();
    let fmt = |v: &f64| format!("{:.1}", if v.abs() < 1e-9 { 0.0 } else { *v });
    chart.configure_mesh().disable_mesh().x_desc("PC1").y_desc("PC2")
        .x_label_formatter(&fmt).y_label_formatter(&fmt)
        .label_style((FONT, 13)).axis_desc_style((FONT, 15)).draw().unwrap();
    chart.draw_series(shown.iter().map(|&i| Circle::new(pc[i], 1, rgb(reps[labels[i] as usize].rgb).filled()))).unwrap();
    for (k, r) in reps.iter().enumerate() {
        let el = EmptyElement::at(r.pc)
            + Circle::new((0, 0), 9, BLACK.filled())
            + Circle::new((0, 0), 7, WHITE.filled())
            + Circle::new((0, 0), 5, rgb(r.rgb).filled());
        chart.draw_series(std::iter::once(el)).unwrap();
        tag(&mut chart, r.pc, &(k + 1).to_string(), (8, -24), WHITE, 13);
    }
}

pub struct View<'a> {
    pub x: (f64, f64),
    pub y: (f64, f64),
    pub shown: &'a [usize],
    pub pc: &'a [(f64, f64)],
}

pub fn step_figure(area: &DrawingArea<BitMapBackend, plotters::coord::Shift>, img: &Image, view: &View,
                   plot_title: &str, image_title: &str, reps: &[Rep], asg: &Assignment) {
    let (w, h) = (img.width as f64, img.height as f64);
    let (top, strip) = area.split_vertically(570);
    let (left, right) = top.split_horizontally(650);
    pca_view(&left, plot_title, view.x, view.y, view.shown, view.pc, &asg.labels, reps);
    let rec = reconstruct(img, &asg.labels, reps);
    let mut chart = image_chart(&right, image_title, (0.0, w), (0.0, h));
    draw_pixels(&mut chart, &rec, (0.0, w), (0.0, h), 2);
    strip.draw(&Text::new("Palette (number = class):", (20, 30), (FONT, 16))).unwrap();
    for (k, rep) in reps.iter().enumerate() {
        let x0 = 230 + k as i32 * 125;
        strip.draw(&Rectangle::new([(x0, 14), (x0 + 50, 64)], rgb(rep.rgb).filled())).unwrap();
        strip.draw(&Rectangle::new([(x0, 14), (x0 + 50, 64)], ShapeStyle { color: BLACK.to_rgba(), filled: false, stroke_width: 1 })).unwrap();
        let share = 100.0 * asg.counts[k] as f64 / img.len() as f64;
        strip.draw(&Text::new(format!("{}", k + 1), (x0 + 56, 18), (FONT, 15))).unwrap();
        strip.draw(&Text::new(format!("{share:.1}%"), (x0 + 56, 40), (FONT, 13))).unwrap();
    }
}
