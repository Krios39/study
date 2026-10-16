use std::fs;

use hw7::draw::{FONT, cross, draw_pixels, image_chart, marker, outline, plasma, tag};
use hw7::{Image, NineTree, Rect, load_png};
use plotters::prelude::*;
use serde_json::json;

fn rect_json(r: &Rect) -> serde_json::Value {
    json!([r.xmin, r.ymin, r.xmax, r.ymax])
}

fn codes_figure(a: &Image, points: &[(String, (usize, usize))]) {
    let root = BitMapBackend::new("HW7_T1_codes.jpg", (1500, 1040)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let (w, h) = (a.width as f64, a.height as f64);
    let mut chart = image_chart(&root, "Image A: representative pixels of the twelve depth-7 codes", (0.0, w), (0.0, h));
    draw_pixels(&mut chart, a, (0.0, w), (0.0, h), 1);
    for (code, (x, y)) in points {
        let at = (*x as f64 + 0.5, *y as f64 + 0.5);
        marker(&mut chart, at);
        let dx = if *x as f64 > w - 160.0 { -86 } else { 10 };
        let dy = if (*y as f64) < 60.0 { 8 } else { -28 };
        tag(&mut chart, at, code, (dx, dy), WHITE, 14);
    }
    root.present().unwrap();
}

fn boxes_figure(a: &Image, boxes: &[(String, Rect)], centre: (f64, f64)) {
    let root = BitMapBackend::new("HW7_T1_boxes.jpg", (1500, 1080)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let (top, panels) = root.split_vertically(40);
    top.draw(&Text::new("Ancestor boxes of 1234567 (x = decoded centre; zoom 3 shows the pixel grid)", (380, 10), (FONT, 22))).unwrap();
    let views = [
        ("Whole image", (0.0, a.width as f64), (0.0, a.height as f64), 2),
        ("Zoom 1: boxes 1, 12, 123", (150.0, 520.0), (0.0, 360.0), 1),
        ("Zoom 2: boxes 123, 1234, 12345", (280.0, 345.0), (0.0, 40.0), 1),
        ("Zoom 3: boxes 12345, 123456, 1234567", (334.5, 342.0), (20.5, 26.0), 1),
    ];
    for (area, (title, xr, yr, step)) in panels.split_evenly((2, 2)).iter().zip(views) {
        let mut chart = image_chart(area, title, xr, yr);
        draw_pixels(&mut chart, a, xr, yr, step);
        if title.starts_with("Zoom 3") {
            let grid = ShapeStyle { color: WHITE.mix(0.6), filled: false, stroke_width: 1 };
            for gx in 335..=342 {
                chart.draw_series(LineSeries::new([(gx as f64, yr.0), (gx as f64, yr.1)], grid)).unwrap();
            }
            for gy in 21..=26 {
                chart.draw_series(LineSeries::new([(xr.0, gy as f64), (xr.1, gy as f64)], grid)).unwrap();
            }
        }
        for (i, (_, r)) in boxes.iter().enumerate() {
            outline(&mut chart, [r.xmin, r.ymin, r.xmax, r.ymax], plasma(0.85 * i as f64 / (boxes.len() - 1) as f64), 3);
        }
        cross(&mut chart, centre);
        let span = xr.1 - xr.0;
        for (i, (name, r)) in boxes.iter().enumerate() {
            let visible = r.xmin < xr.1 && r.xmax > xr.0 && r.ymin < yr.1 && r.ymax > yr.0;
            let width = r.xmax - r.xmin;
            if visible && width > span / 40.0 && width < span * 3.0 {
                let colour = plasma(0.85 * i as f64 / (boxes.len() - 1) as f64);
                let lx = r.xmin.max(xr.0);
                if name == "ROOT" {
                    tag(&mut chart, (lx, r.ymax.min(yr.1)), name, (4, -24), colour, 13);
                } else if r.ymin > yr.0 + (yr.1 - yr.0) * 0.06 {
                    tag(&mut chart, (lx, r.ymin), name, (0, -22), colour, 13);
                } else {
                    tag(&mut chart, (lx, r.ymin.max(yr.0)), name, (4, 4), colour, 13);
                }
            }
        }
    }
    root.present().unwrap();
}

fn main() {
    let a = load_png("HW7_01.png");
    let (w, h) = (a.width, a.height);
    let d0 = (0..).find(|&d| 3usize.pow(d) >= w.max(h)).unwrap();
    let d = d0.max(7);
    println!("W = {w}, H = {h}, d0 = {d0}, d = {d}");
    println!("cell size at depth {d}: {:.4} x {:.4} pixels", w as f64 / 3f64.powi(d as i32), h as f64 / 3f64.powi(d as i32));

    let tree = NineTree::image(w, h);
    let prefixes = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "1234567", "7654321", "5555555"];
    let mut codes = Vec::new();
    println!("\n{:<9} {:>30} {:>22} {:>10} {:>15} {:>12}", "code", "rectangle", "centre", "pixel", "RGB", "pixel code");
    for p in prefixes {
        let code = format!("{p:9<width$}", width = d as usize);
        let r = tree.decode(&code);
        let (xc, yc) = r.centre();
        let (px, py) = (xc.floor() as usize, yc.floor() as usize);
        let rgb = a.pixel(px, py);
        let reencoded = tree.encode((xc, yc), d);
        assert_eq!(reencoded, code, "centre does not re-encode");
        let pixel_code = tree.encode((px as f64 + 0.5, py as f64 + 0.5), d);
        println!("{code:<9} [{:8.3},{:8.3})x[{:8.3},{:8.3}) ({xc:9.4},{yc:9.4}) {:>10} {:>15} {pixel_code:>12}",
                 r.xmin, r.xmax, r.ymin, r.ymax, format!("({px},{py})"), format!("{rgb:?}"));
        codes.push(json!({
            "prefix": p, "code": code, "rect": rect_json(&r), "centre": [xc, yc],
            "pixel": [px, py], "pixel_id": py * w + px, "rgb": rgb, "pixel_centre_code": pixel_code,
        }));
    }
    let pixels: Vec<_> = codes.iter().map(|c| c["pixel"].clone()).collect();
    let shared = pixels.iter().enumerate().filter(|(i, p)| pixels[..*i].contains(p)).count();
    println!("codes sharing a pixel with an earlier code: {shared}");

    let full = format!("{:9<width$}", "1234567", width = d as usize);
    let centre = tree.decode(&full).centre();
    let mut boxes = Vec::new();
    let mut previous: Option<Rect> = None;
    println!("\n{:<9} {:>5} {:>44} {:>12} {:>12}", "prefix", "depth", "xmin, ymin, xmax, ymax", "width", "height");
    for k in (0..=full.len()).rev() {
        let prefix = &full[..k];
        let r = tree.decode(prefix);
        if let Some(prev) = previous {
            assert!(r.contains_rect(&prev), "box does not contain the previous one");
            assert!(((r.xmax - r.xmin) / (prev.xmax - prev.xmin) - 3.0).abs() < 1e-9);
        }
        assert!(r.contains(centre), "box does not contain the decoded centre");
        println!("{:<9} {k:>5} {:>10.4}, {:>9.4}, {:>9.4}, {:>9.4} {:>12.5} {:>12.5}",
                 if k == 0 { "ROOT" } else { prefix }, r.xmin, r.ymin, r.xmax, r.ymax, r.xmax - r.xmin, r.ymax - r.ymin);
        boxes.push(json!({ "prefix": if k == 0 { "ROOT" } else { prefix }, "depth": k, "rect": rect_json(&r) }));
        previous = Some(r);
    }
    println!("all checks passed: centres re-encode, boxes are nested and contain the centre");

    let points: Vec<(String, (usize, usize))> = codes.iter()
        .map(|c| (c["code"].as_str().unwrap().to_string(), (c["pixel"][0].as_u64().unwrap() as usize, c["pixel"][1].as_u64().unwrap() as usize)))
        .collect();
    codes_figure(&a, &points);
    let rects: Vec<(String, Rect)> = boxes.iter().map(|b| {
        let v: Vec<f64> = b["rect"].as_array().unwrap().iter().map(|x| x.as_f64().unwrap()).collect();
        (b["prefix"].as_str().unwrap().to_string(), Rect { xmin: v[0], ymin: v[1], xmax: v[2], ymax: v[3] })
    }).collect();
    boxes_figure(&a, &rects, centre);
    println!("wrote HW7_T1_codes.jpg, HW7_T1_boxes.jpg");

    let out = json!({ "width": w, "height": h, "d0": d0, "d": d, "codes": codes, "boxes": boxes, "centre": [centre.0, centre.1] });
    fs::write("HW7_T1_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
    println!("wrote HW7_T1_results.json");
}
