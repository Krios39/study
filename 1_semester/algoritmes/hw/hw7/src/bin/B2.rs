use std::fs;
use std::time::Instant;

use hw7::draw::{FONT, draw_pixels, image_chart, tag};
use hw7::rptree::{Tree, Vec15, exhaustive, sample, strip_bytes};
use hw7::{SplitMix64, load_png, strip_xy};
use plotters::prelude::*;
use serde_json::json;

const SAMPLE: usize = 50_000;
const QUERIES: usize = 100;
const QUERY_SEED: u64 = 9;
const RUNS: usize = 3;

fn median(mut v: Vec<f64>) -> f64 {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v[v.len() / 2]
}

fn main() {
    let a = load_png("HW7_01.png");
    let b = load_png("HW7_02.png");
    let ids_a = sample(&a, SAMPLE, 7);
    let ids_b = sample(&b, SAMPLE, 8);
    let vec_a: Vec<Vec15> = ids_a.iter().map(|&i| strip_bytes(&a, i)).collect();
    let vec_b: Vec<Vec15> = ids_b.iter().map(|&i| strip_bytes(&b, i)).collect();

    let builds: Vec<f64> = (0..RUNS).map(|_| {
        let t = Instant::now();
        let tree = Tree::build(vec_a.clone(), ids_a.clone(), 70);
        let ms = t.elapsed().as_secs_f64() * 1000.0;
        drop(tree);
        ms
    }).collect();
    let build_ms = median(builds);
    let tree = Tree::build(vec_a.clone(), ids_a.clone(), 70);

    let mut rng = SplitMix64(QUERY_SEED);
    let mut picks = std::collections::BTreeSet::new();
    while picks.len() < QUERIES.min(ids_b.len()) {
        picks.insert(rng.below(ids_b.len() as u64) as usize);
    }
    let queries: Vec<usize> = picks.into_iter().collect();

    let n = ids_a.len();
    let ks: Vec<usize> = {
        let mut v = vec![1, 10, 100, 1000, n.div_ceil(10), n.div_ceil(2), n];
        v.dedup();
        v.into_iter().filter(|&k| k >= 1 && k <= n).collect()
    };
    println!("index: {n} A strips, build {build_ms:.1} ms (median of {RUNS}); {} B queries (seed {QUERY_SEED})", queries.len());
    println!("\n{:>6} {:>13} {:>13} {:>9} {:>16} {:>16} {:>7}", "K", "tree ms", "scan ms", "speedup", "tree dist/query", "scan dist/query", "agree");

    let mut rows = Vec::new();
    let mut crossover = None;
    for &k in &ks {
        let mut tree_times = Vec::new();
        let mut scan_times = Vec::new();
        let mut evaluated = 0usize;
        for _ in 0..RUNS {
            let t = Instant::now();
            let mut ev = 0;
            for &q in &queries {
                let (res, e) = tree.knn(&vec_b[q], ids_b[q], k);
                std::hint::black_box(res);
                ev += e;
            }
            tree_times.push(t.elapsed().as_secs_f64() * 1000.0);
            evaluated = ev;
            let t = Instant::now();
            for &q in &queries {
                std::hint::black_box(exhaustive(&vec_a, &ids_a, &vec_b[q], k));
            }
            scan_times.push(t.elapsed().as_secs_f64() * 1000.0);
        }
        let agree = queries.iter().all(|&q| tree.knn(&vec_b[q], ids_b[q], k).0 == exhaustive(&vec_a, &ids_a, &vec_b[q], k));
        let projections = queries.iter().map(|&q| tree.knn_counted(&vec_b[q], ids_b[q], k).2).sum::<usize>() as f64 / queries.len() as f64;
        assert!(agree, "tree result differs from exhaustive search for K = {k}");
        let (tm, sm) = (median(tree_times), median(scan_times));
        let per_query = evaluated as f64 / queries.len() as f64;
        println!("{k:>6} {tm:>13.2} {sm:>13.2} {:>9.2} {per_query:>16.0} {projections:>12.0} {n:>16} {:>7}", sm / tm, agree);
        if crossover.is_none() && tm >= sm {
            crossover = Some(k);
        }
        rows.push(json!({ "k": k, "tree_ms": tm, "scan_ms": sm, "tree_dist_per_query": per_query, "tree_projections_per_query": projections, "scan_dist_per_query": n, "agree": agree }));
    }
    println!("first K where the index is not faster: {crossover:?}");

    let q = queries[0];
    let (res10, ev10) = tree.knn(&vec_b[q], ids_b[q], 10);
    let strip_json = |img: &hw7::Image, id: usize| {
        let (x, y) = strip_xy(img, id);
        json!({ "id": id, "x": x, "y": y, "rgb": (0..5).map(|k| img.pixel(x + k, y)).collect::<Vec<_>>() })
    };
    let example = json!({
        "query": strip_json(&b, ids_b[q]), "evaluated": ev10,
        "neighbours": res10.iter().map(|&(d2, id)| { let mut s = strip_json(&a, id); s["distance"] = json!((d2 as f64).sqrt()); s }).collect::<Vec<_>>(),
    });

    let root = BitMapBackend::new("HW7_B2_time.jpg", (1300, 520)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let (left, right) = root.split_horizontally(650);
    let kmax = *ks.last().unwrap() as f64;
    let tmax = rows.iter().map(|r| r["tree_ms"].as_f64().unwrap().max(r["scan_ms"].as_f64().unwrap())).fold(0.0, f64::max);
    let mut chart = ChartBuilder::on(&left).caption("Query time for 100 queries (median of 3 runs)", (FONT, 18)).margin(12)
        .x_label_area_size(40).y_label_area_size(60)
        .build_cartesian_2d((1.0..kmax * 1.3).log_scale(), 0.0..tmax * 1.1).unwrap();
    chart.configure_mesh().x_desc("K (log scale)").y_desc("ms").label_style((FONT, 13)).axis_desc_style((FONT, 15)).draw().unwrap();
    for (key, color, name) in [("tree_ms", RGBColor(220, 38, 38), "RP-tree with backtracking"), ("scan_ms", RGBColor(37, 99, 235), "exhaustive scan")] {
        let pts: Vec<(f64, f64)> = rows.iter().map(|r| (r["k"].as_f64().unwrap(), r[key].as_f64().unwrap())).collect();
        chart.draw_series(LineSeries::new(pts.clone(), ShapeStyle { color: color.to_rgba(), filled: false, stroke_width: 3 })).unwrap()
            .label(name).legend(move |(x, y)| PathElement::new(vec![(x, y), (x + 20, y)], ShapeStyle { color: color.to_rgba(), filled: false, stroke_width: 3 }));
        chart.draw_series(pts.iter().map(|&p| Circle::new(p, 5, color.filled()))).unwrap();
    }
    chart.configure_series_labels().background_style(WHITE.mix(0.9)).border_style(BLACK).label_font((FONT, 13)).position(SeriesLabelPosition::UpperLeft).draw().unwrap();
    let mut chart = ChartBuilder::on(&right).caption("Distance evaluations per query", (FONT, 18)).margin(12)
        .x_label_area_size(40).y_label_area_size(70)
        .build_cartesian_2d((1.0..kmax * 1.3).log_scale(), (1.0..n as f64 * 1.5).log_scale()).unwrap();
    chart.configure_mesh().x_desc("K (log scale)").y_desc("distances (log scale)").label_style((FONT, 13)).axis_desc_style((FONT, 15)).draw().unwrap();
    let pts: Vec<(f64, f64)> = rows.iter().map(|r| (r["k"].as_f64().unwrap(), r["tree_dist_per_query"].as_f64().unwrap())).collect();
    chart.draw_series(LineSeries::new(pts.clone(), ShapeStyle { color: RGBColor(220, 38, 38).to_rgba(), filled: false, stroke_width: 3 })).unwrap();
    chart.draw_series(pts.iter().map(|&p| Circle::new(p, 5, RGBColor(220, 38, 38).filled()))).unwrap();
    chart.draw_series(LineSeries::new(vec![(1.0, n as f64), (kmax, n as f64)], ShapeStyle { color: RGBColor(37, 99, 235).to_rgba(), filled: false, stroke_width: 3 })).unwrap();
    root.present().unwrap();

    let root = BitMapBackend::new("HW7_B2_query.jpg", (1600, 600)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let (left, right) = root.split_horizontally(800);
    let (xq, yq) = strip_xy(&b, ids_b[q]);
    let mut chart = image_chart(&left, "Query strip on image B", (0.0, b.width as f64), (0.0, b.height as f64));
    draw_pixels(&mut chart, &b, (0.0, b.width as f64), (0.0, b.height as f64), 2);
    let mark = |chart: &mut hw7::draw::Chart, x: usize, y: usize, label: &str| {
        let at = (x as f64 + 2.5, y as f64 + 0.5);
        let el = EmptyElement::at(at)
            + Rectangle::new([(-10, -7), (10, 7)], ShapeStyle { color: BLACK.to_rgba(), filled: false, stroke_width: 4 })
            + Rectangle::new([(-10, -7), (10, 7)], ShapeStyle { color: YELLOW.to_rgba(), filled: false, stroke_width: 2 });
        chart.draw_series(std::iter::once(el)).unwrap();
        tag(chart, at, label, (10, if y < 60 { 8 } else { -24 }), WHITE, 13);
    };
    mark(&mut chart, xq, yq, "query");
    let mut chart = image_chart(&right, "Its 10 nearest A strips (exact K = 10 search)", (0.0, a.width as f64), (0.0, a.height as f64));
    draw_pixels(&mut chart, &a, (0.0, a.width as f64), (0.0, a.height as f64), 2);
    for (rank, &(_, id)) in res10.iter().enumerate() {
        let (x, y) = strip_xy(&a, id);
        mark(&mut chart, x, y, &(rank + 1).to_string());
    }
    root.present().unwrap();

    let out = json!({
        "index_size": n, "build_ms": build_ms, "runs": RUNS, "queries": queries.len(), "query_seed": QUERY_SEED,
        "query_ids": queries.iter().map(|&q| ids_b[q]).collect::<Vec<_>>(), "rows": rows,
        "crossover": crossover, "example": example,
        "k10": queries.iter().map(|&q| tree.knn(&vec_b[q], ids_b[q], 10).0.iter().map(|&(d2, id)| json!([id, d2])).collect::<Vec<_>>()).collect::<Vec<_>>(),
    });
    fs::write("HW7_B2_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
    println!("wrote HW7_B2_time.jpg, HW7_B2_query.jpg, HW7_B2_results.json");
}
