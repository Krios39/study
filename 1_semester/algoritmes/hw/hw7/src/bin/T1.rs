use std::fs;

use hw7::{NineTree, Rect, load_png};
use serde_json::json;

fn rect_json(r: &Rect) -> serde_json::Value {
    json!([r.xmin, r.ymin, r.xmax, r.ymax])
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

    let out = json!({ "width": w, "height": h, "d0": d0, "d": d, "codes": codes, "boxes": boxes, "centre": [centre.0, centre.1] });
    fs::write("HW7_T1_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
    println!("wrote HW7_T1_results.json");
}
