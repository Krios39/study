//! Cheapest insertion heuristic for a 2000-city TSP, run from every start city.
//!
//! Concurrency pattern: embarrassingly parallel work with a static split.
//! The 2000 independent runs are divided between 8 scoped threads
//! (thread `k` takes start cities `i` with `i % 8 == k`). The threads only
//! read the shared distance matrix and return their own results, so no
//! locks, atomics or channels are needed. The program also measures one run
//! and all runs, which shows the speed-up of the parallel version.
//!
//! `load_points`, `point_distances`, `tour_length` and `save_ids` come from
//! the homework library crate (`hw9`) and are not part of this example.

use std::time::Instant;

use serde_json::json;

use hw9::*;

/// Builds a tour by repeatedly inserting the city whose insertion makes the
/// tour longest by the smallest amount. Plain sequential code: each thread
/// calls it many times with different start cities.
fn cheapest_insertion(d: &[Vec<f64>], start: usize) -> Vec<usize> {
    let n = d.len();
    // Initial two-city tour: the start and its nearest neighbour.
    let first = (0..n).filter(|&j| j != start).min_by(|&a, &b| d[start][a].total_cmp(&d[start][b]).then(a.cmp(&b))).unwrap();
    // The tour is stored as a linked list: next[city] is the following city.
    let mut next = vec![usize::MAX; n];
    next[start] = first;
    next[first] = start;
    let mut in_tour = vec![start, first];
    // Extra length when city c is inserted between a and b.
    let cost = |c: usize, a: usize, b: usize| d[a][c] + d[c][b] - d[a][b];
    // best[c] = (cheapest insertion cost of c, city after which to insert it).
    let mut best: Vec<(f64, usize)> = (0..n).map(|c| {
        (cost(c, start, first), start)
    }).collect();
    let mut outside: Vec<usize> = (0..n).filter(|&c| c != start && c != first).collect();
    while !outside.is_empty() {
        // Take the city with the cheapest insertion and insert it.
        let (index, &c) = outside.iter().enumerate().min_by(|x, y| best[*x.1].0.total_cmp(&best[*y.1].0).then(x.1.cmp(y.1))).unwrap();
        outside.swap_remove(index);
        let a = best[c].1;
        let b = next[a];
        next[a] = c;
        next[c] = b;
        in_tour.push(c);
        // Update the cached costs: only edges a->c and c->b are new.
        for &o in &outside {
            if best[o].1 == a {
                // The edge this city wanted to use was removed: full rescan.
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
    // Convert the linked list into the order of visited cities.
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

    // Sequential baseline: time of a single run.
    let t = Instant::now();
    let one = cheapest_insertion(&d, 0);
    let one_time = t.elapsed().as_secs_f64();
    println!("start ID 1: {:.3} in {one_time:.3}s", tour_length(&d, &one));

    // Parallel part: all n start cities on 8 threads.
    let t = Instant::now();
    let threads = 8;
    // `thread::scope` guarantees that every thread spawned inside the closure
    // is joined before the scope returns. Because of this the threads may
    // borrow local variables (`d`) by reference; no `Arc` and no copying of
    // the 2000x2000 matrix is needed.
    let mut runs: Vec<(usize, f64, Vec<usize>)> = std::thread::scope(|s| {
        let handles: Vec<_> = (0..threads).map(|k| {
            // Shared read-only borrow; `move` copies only this reference
            // (and `k`) into the thread.
            let d = &d;
            // Static round-robin split of the work: thread k gets every
            // 8th start city. All runs take about the same time, so this
            // balances the load well without any work queue.
            s.spawn(move || (0..n).filter(|i| i % threads == k).map(|i| {
                let tour = cheapest_insertion(d, i);
                (i, tour_length(d, &tour), tour)
            }).collect::<Vec<_>>())
        }).collect();
        // `join` waits for a thread and returns its result. The results are
        // merged only here, on the main thread, so the workers never write
        // to shared memory.
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
