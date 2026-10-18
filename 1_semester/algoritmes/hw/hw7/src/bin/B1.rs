use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::time::Instant;

use hw7::draw::{draw_pixels, image_chart, tag};
use hw7::rptree::{LEAF_SIZE, Node, Tree, Vec15, dist2, sample, strip_bytes};
use hw7::{Image, load_png, strip_xy};
use plotters::prelude::*;
use serde_json::{Value, json};

const SAMPLE: usize = 50_000;
const SEED_A: u64 = 7;
const SEED_B: u64 = 8;
const BUILD_SEED: u64 = 70;

fn strip_json(img: &Image, id: usize) -> Value {
    let (x, y) = strip_xy(img, id);
    json!({ "id": id, "x": x, "y": y, "rgb": (0..5).map(|k| img.pixel(x + k, y)).collect::<Vec<_>>() })
}

fn check_partition(tree: &Tree) -> (usize, usize) {
    let mut seen = vec![0usize; tree.vectors.len()];
    let mut leaves = 0;
    let mut largest = 0;
    for node in &tree.nodes {
        if let Node::Leaf { items, .. } = node {
            leaves += 1;
            largest = largest.max(items.len());
            assert!(items.len() <= LEAF_SIZE, "leaf too large");
            for &i in items {
                seen[i] += 1;
            }
        }
    }
    assert!(seen.iter().all(|&c| c == 1), "a record is not in exactly one leaf");
    (leaves, largest)
}

fn main() {
    let a = load_png("HW7_01.png");
    let b = load_png("HW7_02.png");
    let ids_a = sample(&a, SAMPLE, SEED_A);
    let ids_b = sample(&b, SAMPLE, SEED_B);
    let vec_a: Vec<Vec15> = ids_a.iter().map(|&i| strip_bytes(&a, i)).collect();
    let vec_b: Vec<Vec15> = ids_b.iter().map(|&i| strip_bytes(&b, i)).collect();

    let start = Instant::now();
    let tree = Tree::build(vec_a.clone(), ids_a.clone(), BUILD_SEED);
    let build_ms = start.elapsed().as_secs_f64() * 1000.0;
    let (leaves, largest) = check_partition(&tree);
    let depth = tree.depth();
    println!("A sample {} strips (seed {SEED_A}), B sample {} strips (seed {SEED_B}), build seed {BUILD_SEED}", ids_a.len(), ids_b.len());
    println!("tree: {} nodes, {} internal, {leaves} leaves, largest leaf {largest}, depth {depth}, build {build_ms:.1} ms",
             tree.nodes.len(), tree.nodes.len() - leaves);

    let same = vec![vec_a[0]; 1000];
    let identical = Tree::build(same, (0..1000).collect(), BUILD_SEED);
    let (id_leaves, id_largest) = check_partition(&identical);
    println!("all-identical test: 1000 equal vectors -> {id_leaves} leaves, largest {id_largest}, depth {}", identical.depth());

    let mut visits: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
    for (k, v) in vec_b.iter().enumerate() {
        visits.entry(tree.route(v, ids_b[k])).or_default().push(k);
    }
    let total: usize = visits.values().map(Vec::len).sum();
    assert_eq!(total, ids_b.len(), "B visits do not sum to the query sample size");
    let empty_leaves = leaves - visits.len();
    println!("B routing: {total} records reached {} leaves, {empty_leaves} leaves received none", visits.len());

    let path_of = |n: usize| match &tree.nodes[n] { Node::Leaf { path, .. } => path.clone(), _ => unreachable!() };
    let mut ranked: Vec<(usize, String, usize)> = visits.iter().map(|(&n, v)| (v.len(), path_of(n), n)).collect();
    ranked.sort_by(|x, y| y.0.cmp(&x.0).then(x.1.cmp(&y.1)));

    let mut rows = Vec::new();
    println!("\n{:<18} {:>7} {:>7} {:>10} {:>10} {:>9} {:>14}", "leaf path", "A", "B", "A strip", "B strip", "distance", "distinct A/B");
    for (count_b, path, node) in ranked.iter().take(10) {
        let items = match &tree.nodes[*node] { Node::Leaf { items, .. } => items.clone(), _ => unreachable!() };
        let mut mean = [0.0f64; 15];
        for &i in &items {
            for k in 0..15 {
                mean[k] += vec_a[i][k] as f64 / items.len() as f64;
            }
        }
        let to_mean = |v: &Vec15| (0..15).map(|k| (v[k] as f64 - mean[k]).powi(2)).sum::<f64>();
        let ch_a = *items.iter().min_by(|&&x, &&y| to_mean(&vec_a[x]).partial_cmp(&to_mean(&vec_a[y])).unwrap().then(ids_a[x].cmp(&ids_a[y]))).unwrap();
        let routed = &visits[node];
        let ch_b = *routed.iter().min_by_key(|&&k| (dist2(&vec_b[k], &vec_a[ch_a]), ids_b[k])).unwrap();
        let d = (dist2(&vec_b[ch_b], &vec_a[ch_a]) as f64).sqrt();
        let distinct_a: BTreeSet<Vec15> = items.iter().map(|&i| vec_a[i]).collect();
        let distinct_b: BTreeSet<Vec15> = routed.iter().map(|&k| vec_b[k]).collect();
        let identical_strips = distinct_a.len() == 1;
        println!("{path:<18} {:>7} {count_b:>7} {:>10} {:>10} {d:>9.1} {:>7}/{:<6}", items.len(), ids_a[ch_a], ids_b[ch_b], distinct_a.len(), distinct_b.len());
        rows.push(json!({
            "path": path, "a_count": items.len(), "b_count": count_b, "a_strip": strip_json(&a, ids_a[ch_a]), "b_strip": strip_json(&b, ids_b[ch_b]),
            "distance": d, "distinct_a": distinct_a.len(), "distinct_b": distinct_b.len(), "all_a_identical": identical_strips,
        }));
    }

    let root = BitMapBackend::new("HW7_B1_locations.jpg", (1600, 600)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let (left, right) = root.split_horizontally(800);
    for (area, img, key, title) in [(&left, &a, "a_strip", "Image A: characteristic A strip of each top leaf"),
                                    (&right, &b, "b_strip", "Image B: the routed B strip nearest to it")] {
        let (w, h) = (img.width as f64, img.height as f64);
        let mut chart = image_chart(area, title, (0.0, w), (0.0, h));
        draw_pixels(&mut chart, img, (0.0, w), (0.0, h), 2);
        for (rank, row) in rows.iter().enumerate() {
            let s = &row[key];
            let at = (s["x"].as_f64().unwrap() + 2.5, s["y"].as_f64().unwrap() + 0.5);
            let el = EmptyElement::at(at)
                + Rectangle::new([(-10, -7), (10, 7)], ShapeStyle { color: BLACK.to_rgba(), filled: false, stroke_width: 4 })
                + Rectangle::new([(-10, -7), (10, 7)], ShapeStyle { color: YELLOW.to_rgba(), filled: false, stroke_width: 2 });
            chart.draw_series(std::iter::once(el)).unwrap();
            tag(&mut chart, at, &(rank + 1).to_string(), (10, if at.1 < 60.0 { 8 } else { -24 }), WHITE, 13);
        }
    }
    root.present().unwrap();

    let distribution: BTreeMap<usize, usize> = visits.values().fold(BTreeMap::new(), |mut m, v| { *m.entry(v.len()).or_default() += 1; m });
    let out = json!({
        "sample_a": ids_a.len(), "sample_b": ids_b.len(), "seed_a": SEED_A, "seed_b": SEED_B, "build_seed": BUILD_SEED, "leaf_size": LEAF_SIZE,
        "nodes": tree.nodes.len(), "internal": tree.nodes.len() - leaves, "leaves": leaves, "largest_leaf": largest, "depth": depth, "build_ms": build_ms,
        "identical_test": { "records": 1000, "leaves": id_leaves, "largest_leaf": id_largest, "depth": identical.depth() },
        "b_total": total, "leaves_visited": visits.len(), "empty_leaves": empty_leaves,
        "visit_distribution": distribution.iter().map(|(k, v)| json!([k, v])).collect::<Vec<_>>(),
        "top": rows, "ids_a": ids_a, "ids_b": ids_b,
    });
    fs::write("HW7_B1_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
    println!("\nwrote HW7_B1_locations.jpg, HW7_B1_results.json");
}
