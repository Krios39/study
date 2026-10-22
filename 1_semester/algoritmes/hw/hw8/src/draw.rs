use plotters::prelude::*;

use crate::Graph;

pub const FONT: &str = "sans-serif";

pub const GROUP_COLORS: [RGBColor; 5] = [
    RGBColor(253, 230, 138),
    RGBColor(191, 219, 254),
    RGBColor(187, 247, 208),
    RGBColor(254, 202, 202),
    RGBColor(226, 232, 240),
];

fn stroke(color: RGBColor, width: u32) -> ShapeStyle {
    ShapeStyle { color: color.to_rgba(), filled: false, stroke_width: width }
}

pub fn viridis(t: f64) -> RGBColor {
    let stops = [(68.0, 1.0, 84.0), (59.0, 82.0, 139.0), (33.0, 145.0, 140.0), (94.0, 201.0, 98.0), (253.0, 231.0, 37.0)];
    let x = t.clamp(0.0, 1.0) * (stops.len() - 1) as f64;
    let i = (x.floor() as usize).min(stops.len() - 2);
    let f = x - i as f64;
    let mix = |a: f64, b: f64| (a + (b - a) * f) as u8;
    RGBColor(mix(stops[i].0, stops[i + 1].0), mix(stops[i].1, stops[i + 1].1), mix(stops[i].2, stops[i + 1].2))
}

fn ink(fill: RGBColor) -> RGBColor {
    let luma = 0.299 * fill.0 as f64 + 0.587 * fill.1 as f64 + 0.114 * fill.2 as f64;
    if luma < 120.0 { WHITE } else { BLACK }
}

const SCALE: f64 = 150.0;
const PAD: f64 = 80.0;
const TOP: f64 = 50.0;

fn graph_size(g: &Graph) -> (u32, u32) {
    let (xmin, xmax) = g.pos.iter().fold((f64::MAX, f64::MIN), |(a, b), p| (a.min(p.0), b.max(p.0)));
    let (ymin, ymax) = g.pos.iter().fold((f64::MAX, f64::MIN), |(a, b), p| (a.min(p.1), b.max(p.1)));
    (((xmax - xmin) * SCALE + 2.0 * PAD) as u32, ((ymax - ymin) * SCALE + 2.0 * PAD + TOP) as u32)
}

pub fn graph_on<DB: DrawingBackend>(root: &DrawingArea<DB, plotters::coord::Shift>, g: &Graph, title: &str,
                                    highlight: &[(usize, usize)], values: Option<(&[f64], f64)>, weights: bool) {
    let xmin = g.pos.iter().map(|p| p.0).fold(f64::MAX, f64::min);
    let ymax = g.pos.iter().map(|p| p.1).fold(f64::MIN, f64::max);
    let px = |i: usize| (PAD + (g.pos[i].0 - xmin) * SCALE, TOP + PAD + (ymax - g.pos[i].1) * SCALE);
    root.draw(&Text::new(title.to_string(), (PAD as i32 - 50, 16), (FONT, 24).into_font())).unwrap();
    let radius = 27.0;
    let has = |u: usize, v: usize| g.edges.iter().any(|&(a, b, _)| a == u && b == v);
    for &(u, v, w) in &g.edges {
        let ((x0, y0), (x1, y1)) = (px(u), px(v));
        let (dx, dy) = (x1 - x0, y1 - y0);
        let len = (dx * dx + dy * dy).sqrt();
        let (ux, uy) = (dx / len, dy / len);
        let shift = if has(v, u) { 7.0 } else { 0.0 };
        let (ox, oy) = (-uy * shift, ux * shift);
        let a = (x0 + ux * radius + ox, y0 + uy * radius + oy);
        let b = (x1 - ux * (radius + 2.0) + ox, y1 - uy * (radius + 2.0) + oy);
        let hot = highlight.contains(&(u, v));
        let color = if hot { RGBColor(220, 38, 38) } else { RGBColor(71, 85, 105) };
        let tip = (b.0 - ux * 14.0, b.1 - uy * 14.0);
        root.draw(&PathElement::new(vec![(a.0 as i32, a.1 as i32), (tip.0 as i32, tip.1 as i32)], stroke(color, if hot { 4 } else { 2 }))).unwrap();
        let head = vec![
            (b.0 as i32, b.1 as i32),
            ((tip.0 - uy * 6.0) as i32, (tip.1 + ux * 6.0) as i32),
            ((tip.0 + uy * 6.0) as i32, (tip.1 - ux * 6.0) as i32),
        ];
        root.draw(&Polygon::new(head, color.filled())).unwrap();
        if weights {
            let m = ((a.0 + b.0) / 2.0 + ox * 1.6, (a.1 + b.1) / 2.0 + oy * 1.6);
            let text = format!("{w}");
            let (bw, bh) = (8 * text.len() as i32 + 6, 18);
            let (mx, my) = (m.0 as i32 - bw / 2, m.1 as i32 - bh / 2);
            root.draw(&Rectangle::new([(mx, my), (mx + bw, my + bh)], WHITE.filled())).unwrap();
            root.draw(&Rectangle::new([(mx, my), (mx + bw, my + bh)], stroke(color, 1))).unwrap();
            root.draw(&Text::new(text, (mx + 4, my + 1), (FONT, 15).into_font().color(&color))).unwrap();
        }
    }
    for i in 0..g.n() {
        let (x, y) = px(i);
        let fill = match values {
            Some((v, max)) => viridis(v[i] / max),
            None => GROUP_COLORS[g.group[i].clamp(0, 4) as usize],
        };
        root.draw(&Circle::new((x as i32, y as i32), radius as i32, fill.filled())).unwrap();
        root.draw(&Circle::new((x as i32, y as i32), radius as i32, stroke(BLACK, 2))).unwrap();
        let id = i.to_string();
        root.draw(&Text::new(id.clone(), (x as i32 - 5 * id.len() as i32, y as i32 - 10), (FONT, 20).into_font().color(&ink(fill)))).unwrap();
        let label = match values {
            Some((v, _)) => format!("{} {:.3}", g.labels[i], v[i]),
            None => g.labels[i].clone(),
        };
        let lw = (label.len() as f64 * 8.2) as i32;
        root.draw(&Text::new(label, (x as i32 - lw / 2, y as i32 + radius as i32 + 3), (FONT, 16).into_font().color(&RGBColor(30, 41, 59)))).unwrap();
    }
    if let Some((_, max)) = values {
        let (w, _) = root.dim_in_pixel();
        let (x0, y0, bw, bh) = (w as i32 - 250, 58, 200, 14);
        for k in 0..bw {
            let c = viridis(k as f64 / bw as f64);
            root.draw(&Rectangle::new([(x0 + k, y0), (x0 + k + 1, y0 + bh)], c.filled())).unwrap();
        }
        root.draw(&Rectangle::new([(x0, y0), (x0 + bw, y0 + bh)], stroke(BLACK, 1))).unwrap();
        root.draw(&Text::new("0".to_string(), (x0 - 4, y0 + bh + 3), (FONT, 14).into_font())).unwrap();
        root.draw(&Text::new(format!("{max:.2}"), (x0 + bw - 20, y0 + bh + 3), (FONT, 14).into_font())).unwrap();
        root.draw(&Text::new("probability".to_string(), (x0 + 60, y0 - 18), (FONT, 14).into_font())).unwrap();
    }
}

pub fn graph_figure(path: &str, g: &Graph, title: &str, highlight: &[(usize, usize)]) {
    let root = BitMapBackend::new(path, graph_size(g)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    graph_on(&root, g, title, highlight, None, true);
    root.present().unwrap();
}

pub fn graph_values_row(path: &str, g: &Graph, panels: &[(&str, Vec<f64>)], max: f64, weights: bool) {
    let (w, h) = graph_size(g);
    let root = BitMapBackend::new(path, (w * panels.len() as u32, h)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    for (area, (title, v)) in root.split_evenly((1, panels.len())).iter().zip(panels) {
        graph_on(area, g, title, &[], Some((v, max)), weights);
    }
    root.present().unwrap();
}

pub fn bar_panels(path: &str, labels: &[String], panels: &[(&str, Vec<(String, Vec<f64>, RGBColor)>)], ymax: f64) {
    let root = BitMapBackend::new(path, (1300, 420 * panels.len() as u32)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let n = labels.len();
    for (area, (title, series)) in root.split_evenly((panels.len(), 1)).iter().zip(panels) {
        let mut chart = ChartBuilder::on(area)
            .caption(*title, (FONT, 21))
            .margin(12)
            .x_label_area_size(40)
            .y_label_area_size(70)
            .build_cartesian_2d(-0.5f64..n as f64 - 0.5, 0f64..ymax)
            .unwrap();
        let lab = labels.to_vec();
        let fmt = move |v: &f64| {
            let i = v.round();
            if (v - i).abs() < 1e-6 && i >= 0.0 && (i as usize) < lab.len() { format!("{} {}", i, lab[i as usize]) } else { String::new() }
        };
        chart.configure_mesh().disable_x_mesh()
            .x_labels(n + 1).x_label_formatter(&fmt)
            .y_desc("probability / frequency").label_style((FONT, 14)).axis_desc_style((FONT, 15)).draw().unwrap();
        let k = series.len() as f64;
        let bw = 0.8 / k;
        for (s, (name, vals, color)) in series.iter().enumerate() {
            let c = *color;
            let off = -0.4 + bw * s as f64;
            chart.draw_series(vals.iter().enumerate().map(|(i, &v)| {
                Rectangle::new([(i as f64 + off, 0.0), (i as f64 + off + bw * 0.92, v)], c.filled())
            })).unwrap().label(name.clone()).legend(move |(x, y)| Rectangle::new([(x, y - 6), (x + 14, y + 6)], c.filled()));
        }
        chart.configure_series_labels().position(SeriesLabelPosition::UpperLeft)
            .background_style(WHITE.mix(0.9)).border_style(BLACK).label_font((FONT, 15)).draw().unwrap();
    }
    root.present().unwrap();
}

pub fn error_chart(path: &str, title: &str, series: &[(String, Vec<(f64, f64)>, RGBColor, bool)], x: (f64, f64), y: (f64, f64)) {
    let root = BitMapBackend::new(path, (1100, 620)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let mut chart = ChartBuilder::on(&root)
        .caption(title, (FONT, 22))
        .margin(14)
        .x_label_area_size(46)
        .y_label_area_size(80)
        .build_cartesian_2d((x.0..x.1).log_scale(), (y.0..y.1).log_scale())
        .unwrap();
    chart.configure_mesh()
        .x_desc("M (walkers, log scale)").y_desc("L1 difference (log scale)")
        .x_label_formatter(&|v| format!("{v:.0}")).y_label_formatter(&|v| format!("{v:.3}"))
        .label_style((FONT, 15)).axis_desc_style((FONT, 16)).draw().unwrap();
    for (name, pts, color, line) in series {
        let c = *color;
        if *line {
            chart.draw_series(LineSeries::new(pts.clone(), stroke(c, 3))).unwrap()
                .label(name.clone()).legend(move |(x, y)| PathElement::new(vec![(x, y), (x + 24, y)], stroke(c, 3)));
        } else {
            chart.draw_series(pts.iter().map(|&p| Circle::new(p, 3, c.mix(0.45).filled()))).unwrap()
                .label(name.clone()).legend(move |(x, y)| Circle::new((x + 12, y), 4, c.filled()));
        }
    }
    chart.configure_series_labels().position(SeriesLabelPosition::UpperRight)
        .background_style(WHITE.mix(0.9)).border_style(BLACK).label_font((FONT, 15)).draw().unwrap();
    root.present().unwrap();
}

pub fn heatmap<DB: DrawingBackend>(area: &DrawingArea<DB, plotters::coord::Shift>, title: &str, m: &[Vec<f64>],
                                   labels: Option<&[String]>, numbers: bool, mark: Option<(usize, usize)>) {
    let n = m.len();
    let (w, h) = area.dim_in_pixel();
    let left = if labels.is_some() { 120 } else { 40 };
    let top = 84;
    let cell = ((w as i32 - left - 70).min(h as i32 - top - 20) / n as i32).max(1);
    let max = m.iter().flatten().cloned().fold(0.0, f64::max).max(1e-12);
    area.draw(&Text::new(title.to_string(), (10, 10), (FONT, 22).into_font())).unwrap();
    let color = |v: f64| {
        if v <= 0.0 {
            return RGBColor(248, 250, 252);
        }
        let t = (0.25 + 0.75 * v / max).min(1.0);
        RGBColor((219.0 - 189.0 * t) as u8, (234.0 - 176.0 * t) as u8, (254.0 - 116.0 * t) as u8)
    };
    for i in 0..n {
        for j in 0..n {
            let (x, y) = (left + j as i32 * cell, top + i as i32 * cell);
            let fill = color(m[i][j]);
            area.draw(&Rectangle::new([(x, y), (x + cell, y + cell)], fill.filled())).unwrap();
            if numbers && m[i][j] != 0.0 {
                let text = format!("{}", m[i][j]);
                let ink = if m[i][j] / max > 0.45 { WHITE } else { BLACK };
                area.draw(&Text::new(text.clone(), (x + cell / 2 - 4 * text.len() as i32, y + cell / 2 - 8), (FONT, 15).into_font().color(&ink))).unwrap();
            }
        }
    }
    let size = n as i32 * cell;
    if cell >= 6 {
        for k in 0..=n as i32 {
            let style = stroke(RGBColor(203, 213, 225), 1);
            area.draw(&PathElement::new(vec![(left, top + k * cell), (left + size, top + k * cell)], style)).unwrap();
            area.draw(&PathElement::new(vec![(left + k * cell, top), (left + k * cell, top + size)], style)).unwrap();
        }
    }
    area.draw(&Rectangle::new([(left, top), (left + size, top + size)], stroke(RGBColor(71, 85, 105), 1))).unwrap();
    if let Some((i, j)) = mark {
        let (x, y) = (left + j as i32 * cell, top + i as i32 * cell);
        area.draw(&Rectangle::new([(x - 1, y - 1), (x + cell + 1, y + cell + 1)], stroke(RGBColor(220, 38, 38), 4))).unwrap();
    }
    if let Some(labels) = labels {
        for (i, l) in labels.iter().enumerate() {
            let y = top + i as i32 * cell + cell / 2 - 8;
            area.draw(&Text::new(format!("{i} {l}"), (8, y), (FONT, 14).into_font())).unwrap();
            let id = i.to_string();
            area.draw(&Text::new(id.clone(), (left + i as i32 * cell + cell / 2 - 4 * id.len() as i32, top - 20), (FONT, 14).into_font())).unwrap();
        }
        area.draw(&Text::new("rows = source, columns = destination".to_string(), (left, top - 46), (FONT, 14).into_font().color(&RGBColor(100, 116, 139)))).unwrap();
    } else {
        area.draw(&Text::new(format!("{n} x {n}, rows = source, columns = destination"), (left, top - 26), (FONT, 14).into_font().color(&RGBColor(100, 116, 139)))).unwrap();
    }
}

pub fn heatmap_row(path: &str, panels: &[(&str, Vec<Vec<f64>>, Option<(usize, usize)>)], labels: Option<&[String]>, numbers: bool, panel: (u32, u32)) {
    let root = BitMapBackend::new(path, (panel.0 * panels.len() as u32, panel.1)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let areas = root.split_evenly((1, panels.len()));
    for (area, (title, m, mark)) in areas.iter().zip(panels) {
        heatmap(area, title, m, labels, numbers, *mark);
    }
    root.present().unwrap();
}

pub fn timing_chart(path: &str, series: &[(String, Vec<(f64, f64)>, RGBColor)], limit: f64) {
    let root = BitMapBackend::new(path, (1100, 620)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let ymin = series.iter().flat_map(|s| s.1.iter().map(|p| p.1)).fold(f64::MAX, f64::min) / 2.0;
    let mut chart = ChartBuilder::on(&root)
        .caption("Closure time on cluster_graph(n, seed=8), median of 3 runs", (FONT, 22))
        .margin(14)
        .x_label_area_size(46)
        .y_label_area_size(80)
        .build_cartesian_2d(5.8f64..9.2f64, (ymin..limit * 3.0).log_scale())
        .unwrap();
    chart.configure_mesh()
        .x_desc("n (vertices, log scale)").y_desc("seconds (log scale)")
        .x_labels(8).x_label_formatter(&|v| if (v - v.round()).abs() < 1e-6 { format!("{:.0}", 2f64.powf(*v)) } else { String::new() })
        .y_label_formatter(&|v| format!("{v:.0e}"))
        .label_style((FONT, 15)).axis_desc_style((FONT, 16)).draw().unwrap();
    chart.draw_series(LineSeries::new(vec![(5.8, limit), (9.2, limit)], stroke(RGBColor(148, 163, 184), 2)))
        .unwrap().label(format!("{limit} s limit")).legend(|(x, y)| PathElement::new(vec![(x, y), (x + 24, y)], stroke(RGBColor(148, 163, 184), 2)));
    for (name, pts, color) in series {
        let c = *color;
        let pts: Vec<(f64, f64)> = pts.iter().map(|&(x, y)| (x.log2(), y)).collect();
        chart.draw_series(LineSeries::new(pts.clone(), stroke(c, 3))).unwrap()
            .label(name.clone()).legend(move |(x, y)| PathElement::new(vec![(x, y), (x + 24, y)], stroke(c, 3)));
        chart.draw_series(pts.iter().map(|&p| Circle::new(p, 5, c.filled()))).unwrap();
    }
    chart.configure_series_labels().position(SeriesLabelPosition::UpperLeft)
        .background_style(WHITE.mix(0.9)).border_style(BLACK).label_font((FONT, 15)).draw().unwrap();
    root.present().unwrap();
}
