use std::collections::BTreeSet;
use std::fs;

use hw7::{NineTree, Pca, Rect, SplitMix64, load_png};
use serde_json::json;

const DEPTH: u32 = 4;
const SEED: u64 = 7;

fn main() {
    let a = load_png("HW7_01.png");
    let pca = Pca::load("HW7_pca_model.json");
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
    let out = json!({ "depth": DEPTH, "seed": SEED, "rng": "SplitMix64", "bounds": [lo, hi], "padded_axes": padded, "views": views });
    fs::write("HW7_T2_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
    println!("\nwrote HW7_T2_results.json");
}
