use std::time::Instant;

use serde_json::json;

use hw9::*;

fn cheapest_insertion(d: &[Vec<f64>], start: usize) -> Vec<usize> {
    let n = d.len();
    let first = (0..n).filter(|&j| j != start).min_by(|&a, &b| d[start][a].total_cmp(&d[start][b]).then(a.cmp(&b))).unwrap();
    let mut next = vec![usize::MAX; n];
    next[start] = first;
    next[first] = start;
    let mut in_tour = vec![start, first];
    let cost = |c: usize, a: usize, b: usize| d[a][c] + d[c][b] - d[a][b];
    let mut best: Vec<(f64, usize)> = (0..n).map(|c| {
        (cost(c, start, first), start)
    }).collect();
    let mut outside: Vec<usize> = (0..n).filter(|&c| c != start && c != first).collect();
    while !outside.is_empty() {
        let (index, &c) = outside.iter().enumerate().min_by(|x, y| best[*x.1].0.total_cmp(&best[*y.1].0).then(x.1.cmp(y.1))).unwrap();
        outside.swap_remove(index);
        let a = best[c].1;
        let b = next[a];
        next[a] = c;
        next[c] = b;
        in_tour.push(c);
        for &o in &outside {
            if best[o].1 == a {
                best[o] = (f64::INFINITY, a);
                for &x in &in_tour {
                    let v = cost(o, x, next[x]);
                    if v < best[o].0 {
                        best[o] = (v, x);
                    }
                }
            } else {
                for x in [a, c] {
                    let v = cost(o, x, next[x]);
                    if v < best[o].0 {
                        best[o] = (v, x);
                    }
                }
            }
        }
    }
    let mut tour = Vec::with_capacity(n);
    let mut u = start;
    for _ in 0..n {
        tour.push(u);
        u = next[u];
    }
    tour
}

fn main() {
    let dir = "src/bin/tsp2000";
    let points = load_points("HW9_TSP_2000.txt");
    let d = point_distances(&points);
    let n = d.len();

    let t = Instant::now();
    let one = cheapest_insertion(&d, 0);
    let one_time = t.elapsed().as_secs_f64();
    println!("start ID 1: {:.3} in {one_time:.3}s", tour_length(&d, &one));

    let t = Instant::now();
    let threads = 8;
    let mut runs: Vec<(usize, f64, Vec<usize>)> = std::thread::scope(|s| {
        let handles: Vec<_> = (0..threads).map(|k| {
            let d = &d;
            s.spawn(move || (0..n).filter(|i| i % threads == k).map(|i| {
                let tour = cheapest_insertion(d, i);
                (i, tour_length(d, &tour), tour)
            }).collect::<Vec<_>>())
        }).collect();
        handles.into_iter().flat_map(|h| h.join().unwrap()).collect()
    });
    let all_time = t.elapsed().as_secs_f64();
    runs.sort_by(|a, b| a.1.total_cmp(&b.1));
    let (best, worst, median) = (&runs[0], &runs[n - 1], runs[n / 2].1);
    println!("all {n} starts in {all_time:.1}s: best {:.6} (ID {}), median {median:.3}, worst {:.3} (ID {})", best.1, best.0 + 1, worst.1, worst.0 + 1);
    save_ids(&best.2, &format!("{dir}/HW9_B2_insertion.txt"));
    std::fs::write(format!("{dir}/HW9_B2_insertion_results.json"), serde_json::to_string_pretty(&json!({
        "method": "cheapest insertion from a two-point tour (start and its nearest neighbour), all starts",
        "one_run_seconds": one_time, "all_starts_seconds": all_time, "threads": threads,
        "best": {"start_id": best.0 + 1, "length": best.1}, "worst": {"start_id": worst.0 + 1, "length": worst.1}, "median": median,
    })).unwrap()).unwrap();
}
