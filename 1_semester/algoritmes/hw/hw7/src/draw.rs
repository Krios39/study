use plotters::coord::Shift;
use plotters::coord::types::RangedCoordf64;
use plotters::prelude::*;

use crate::Image;

pub type Chart<'a, 'b> = ChartContext<'a, BitMapBackend<'b>, Cartesian2d<RangedCoordf64, RangedCoordf64>>;

pub const FONT: &str = "sans-serif";

pub fn rgb(c: [u8; 3]) -> RGBColor {
    RGBColor(c[0], c[1], c[2])
}

pub fn image_chart<'a, 'b>(area: &'a DrawingArea<BitMapBackend<'b>, Shift>, title: &str,
                           x: (f64, f64), y: (f64, f64)) -> Chart<'a, 'b> {
    let mut chart = ChartBuilder::on(area)
        .caption(title, (FONT, 20))
        .margin(8)
        .x_label_area_size(36)
        .y_label_area_size(52)
        .build_cartesian_2d(x.0..x.1, y.1..y.0)
        .unwrap();
    let digits = if x.1 - x.0 < 20.0 { 1 } else { 0 };
    let fx = move |v: &f64| format!("{v:.digits$}");
    let fy = move |v: &f64| format!("{v:.digits$}");
    chart.configure_mesh().disable_mesh().x_desc("pixel x").y_desc("pixel y")
        .x_label_formatter(&fx).y_label_formatter(&fy)
        .label_style((FONT, 14)).axis_desc_style((FONT, 15)).draw().unwrap();
    chart
}

pub fn draw_pixels(chart: &mut Chart, img: &Image, x: (f64, f64), y: (f64, f64), step: usize) {
    let x0 = x.0.floor().max(0.0) as usize;
    let x1 = (x.1.ceil() as usize).min(img.width);
    let y0 = y.0.floor().max(0.0) as usize;
    let y1 = (y.1.ceil() as usize).min(img.height);
    let cells = (y0..y1).step_by(step).flat_map(|py| (x0..x1).step_by(step).map(move |px| (px, py)));
    chart.draw_series(cells.map(|(px, py)| {
        let (fx, fy) = (px as f64, py as f64);
        let s = step as f64;
        Rectangle::new([(fx, fy), ((fx + s).min(x1 as f64), (fy + s).min(y1 as f64))], rgb(img.pixel(px, py)).filled())
    })).unwrap();
}

pub fn outline(chart: &mut Chart, r: [f64; 4], color: RGBColor, width: u32) {
    let style = ShapeStyle { color: color.to_rgba(), filled: false, stroke_width: width };
    chart.draw_series(std::iter::once(Rectangle::new([(r[0], r[1]), (r[2], r[3])], style))).unwrap();
}

pub fn tag(chart: &mut Chart, at: (f64, f64), text: &str, offset: (i32, i32), fill: RGBColor, size: u32) {
    let w = (text.len() as f64 * size as f64 * 0.58) as i32 + 8;
    let h = size as i32 + 6;
    let (dx, dy) = offset;
    let el = EmptyElement::at(at)
        + Rectangle::new([(dx, dy), (dx + w, dy + h)], fill.filled())
        + Rectangle::new([(dx, dy), (dx + w, dy + h)], ShapeStyle { color: BLACK.to_rgba(), filled: false, stroke_width: 1 })
        + Text::new(text.to_string(), (dx + 4, dy + 3), (FONT, size).into_font().color(&ink(fill)));
    chart.draw_series(std::iter::once(el)).unwrap();
}

pub fn ink(fill: RGBColor) -> RGBColor {
    let luma = 0.299 * fill.0 as f64 + 0.587 * fill.1 as f64 + 0.114 * fill.2 as f64;
    if luma < 120.0 { WHITE } else { BLACK }
}

pub fn marker(chart: &mut Chart, at: (f64, f64)) {
    let el = EmptyElement::at(at)
        + Circle::new((0, 0), 8, ShapeStyle { color: BLACK.to_rgba(), filled: true, stroke_width: 0 })
        + Circle::new((0, 0), 6, ShapeStyle { color: WHITE.to_rgba(), filled: true, stroke_width: 0 })
        + Circle::new((0, 0), 2, ShapeStyle { color: BLACK.to_rgba(), filled: true, stroke_width: 0 });
    chart.draw_series(std::iter::once(el)).unwrap();
}

pub fn cross(chart: &mut Chart, at: (f64, f64)) {
    chart.draw_series(std::iter::once(Cross::new(at, 8, ShapeStyle { color: WHITE.to_rgba(), filled: false, stroke_width: 5 }))).unwrap();
    chart.draw_series(std::iter::once(Cross::new(at, 7, ShapeStyle { color: BLACK.to_rgba(), filled: false, stroke_width: 2 }))).unwrap();
}

pub fn plasma(t: f64) -> RGBColor {
    let stops = [(13.0, 8.0, 135.0), (126.0, 3.0, 168.0), (204.0, 71.0, 120.0), (248.0, 149.0, 64.0), (240.0, 249.0, 33.0)];
    let x = t.clamp(0.0, 1.0) * (stops.len() - 1) as f64;
    let i = (x.floor() as usize).min(stops.len() - 2);
    let f = x - i as f64;
    let mix = |a: f64, b: f64| (a + (b - a) * f) as u8;
    RGBColor(mix(stops[i].0, stops[i + 1].0), mix(stops[i].1, stops[i + 1].1), mix(stops[i].2, stops[i + 1].2))
}

pub fn equal_ranges(x: (f64, f64), y: (f64, f64), w: f64, h: f64) -> ((f64, f64), (f64, f64)) {
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
