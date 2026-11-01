use std::f64::consts::TAU;
use std::time::Instant;

use serde_json::json;

use hw9::*;

fn spiral(points: &[(f64, f64)], width: f64) -> Vec<usize> {
    let centre = (999.5, 999.5);
    let mut keyed: Vec<(f64, usize)> = points.iter().enumerate().map(|(i, &(x, y))| {
        let (dx, dy) = (x - centre.0, y - centre.1);
        let turn_part = dy.atan2(dx).rem_euclid(TAU) / TAU;
        let r = (dx * dx + dy * dy).sqrt();
        ((r / width - turn_part).round() + turn_part, i)
    }).collect();
    keyed.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.cmp(&b.1)));
    keyed.into_iter().map(|(_, i)| i).collect()
}

fn main() {
    let dir = "src/bin/tsp2000";
    let points = load_points("HW9_TSP_2000.txt");
    let d = point_distances(&points);

    let t = Instant::now();
    let tour = spiral(&points, 100.0);
    let one_run = t.elapsed().as_secs_f64();
    println!("one spiral: {:.3} ms, length {:.3}", one_run * 1000.0, tour_length(&d, &tour));

    let t = Instant::now();
    let mut runs: Vec<(f64, f64)> = (10..=500).map(|w| (w as f64, tour_length(&d, &spiral(&points, w as f64)))).collect();
    let sweep = t.elapsed().as_secs_f64();
    runs.sort_by(|a, b| a.1.total_cmp(&b.1));
    for &(w, l) in runs.iter().take(5) {
        println!("width {w:5.0}: {l:.3}");
    }
    println!("{} widths in {sweep:.3} s; worst {:.3}", runs.len(), runs.last().unwrap().1);

    let (best_width, best_length) = runs[0];
    let best = spiral(&points, best_width);
    save_ids(&best, &format!("{dir}/HW9_B2_spiral.txt"));
    std::fs::write(format!("{dir}/HW9_B2_spiral_results.json"), serde_json::to_string_pretty(&json!({
        "method": "spiral from the centre, clockwise on screen",
        "best_width": best_width, "length": best_length,
        "one_run_seconds": one_run, "sweep_seconds": sweep, "widths_tried": runs.len(),
        "all_widths": runs.iter().map(|&(w, l)| json!({"width": w, "length": l})).collect::<Vec<_>>(),
    })).unwrap()).unwrap();
}
