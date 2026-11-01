use std::time::Instant;

use serde_json::json;

use hw9::*;

const WINDOW: usize = 12;

fn best_order(d: &[Vec<f64>], left: usize, inner: &[usize], right: usize, dp: &mut [f64], from: &mut [u8]) -> (f64, Vec<usize>) {
    let w = inner.len();
    let full = 1usize << w;
    dp[..full * w].fill(f64::INFINITY);
    for j in 0..w {
        dp[(1 << j) * w + j] = d[left][inner[j]];
    }
    for mask in 1..full {
        for j in 0..w {
            let cur = dp[mask * w + j];
            if mask >> j & 1 == 0 || !cur.is_finite() {
                continue;
            }
            for k in 0..w {
                if mask >> k & 1 == 0 {
                    let next = (mask | 1 << k) * w + k;
                    let value = cur + d[inner[j]][inner[k]];
                    if value < dp[next] {
                        dp[next] = value;
                        from[next] = j as u8;
                    }
                }
            }
        }
    }
    let (mut last, mut best) = (0, f64::INFINITY);
    for j in 0..w {
        let value = dp[(full - 1) * w + j] + d[inner[j]][right];
        if value < best {
            best = value;
            last = j;
        }
    }
    let mut order = Vec::with_capacity(w);
    let mut mask = full - 1;
    for _ in 0..w {
        order.push(inner[last]);
        let previous = from[mask * w + last] as usize;
        mask &= !(1 << last);
        last = previous;
    }
    order.reverse();
    (best, order)
}

fn improve(d: &[Vec<f64>], start: &[usize]) -> (Vec<usize>, usize, usize, f64) {
    let n = start.len();
    let mut tour = start.to_vec();
    let mut dp = vec![0.0; (1 << WINDOW) * WINDOW];
    let mut from = vec![0u8; (1 << WINDOW) * WINDOW];
    let (mut passes, mut changes) = (0, 0);
    let t = Instant::now();
    loop {
        passes += 1;
        let mut changed = false;
        for i in 0..n {
            let left = tour[i];
            let inner: Vec<usize> = (1..=WINDOW).map(|k| tour[(i + k) % n]).collect();
            let right = tour[(i + WINDOW + 1) % n];
            let old = d[left][inner[0]] + inner.windows(2).map(|p| d[p[0]][p[1]]).sum::<f64>() + d[inner[WINDOW - 1]][right];
            let (value, order) = best_order(d, left, &inner, right, &mut dp, &mut from);
            if value < old - 1e-9 {
                for (k, &c) in order.iter().enumerate() {
                    tour[(i + 1 + k) % n] = c;
                }
                changed = true;
                changes += 1;
            }
        }
        if !changed {
            break;
        }
    }
    (tour, passes, changes, t.elapsed().as_secs_f64())
}

fn main() {
    let dir = "src/bin/tsp2000";
    let d = point_distances(&load_points("HW9_TSP_2000.txt"));
    let mut results = Vec::new();
    for (name, file) in [("nn_id1", "../../../HW9_TSP_baseline_tour.txt"), ("hungarian", "HW9_B2_hungarian.txt"), ("anneal_from_ant", "HW9_B2_anneal_from_ant.txt")] {
        let start: Vec<usize> = std::fs::read_to_string(format!("{dir}/{file}")).unwrap().split_whitespace().map(|x| x.parse::<usize>().unwrap() - 1).collect();
        let before = tour_length(&d, &start);
        let (tour, passes, changes, seconds) = improve(&d, &start);
        let after = tour_length(&d, &tour);
        println!("{name}: {before:.6} -> {after:.6}, {passes} passes, {changes} changes, {seconds:.1}s");
        save_ids(&tour, &format!("{dir}/HW9_B2_dp_{name}.txt"));
        results.push(json!({"start": name, "before": before, "after": after, "passes": passes, "changes": changes, "seconds": seconds}));
    }
    std::fs::write(format!("{dir}/HW9_B2_dp_results.json"), serde_json::to_string_pretty(&json!({
        "method": "Held-Karp dynamic programming on sliding windows of consecutive tour points, repeated until no window improves",
        "window": WINDOW, "runs": results,
    })).unwrap()).unwrap();
}
