//! Elastic net (Durbin and Willshaw) for a 2000-city TSP.
//!
//! A ring of points is pulled towards the cities and kept short by an
//! elastic force; at the end every city is visited in the order of its
//! nearest ring point.
//!
//! Concurrency pattern: data parallelism with a map-reduce step inside a
//! sequential loop. In every iteration the cities are split between 8 scoped
//! threads; each thread computes the forces of its cities on the ring into a
//! private buffer (map), and the main thread adds the buffers up (reduce)
//! before moving the ring. Threads are created again in every iteration; the
//! end of `thread::scope` acts as a barrier between iterations.
//!
//! `load_points`, `point_distances`, `tour_length` and `save_ids` come from
//! the homework library crate (`hw9`) and are not part of this example.

use std::f64::consts::TAU;
use std::time::Instant;

use serde_json::json;

use hw9::*;

const RING_FACTOR: usize = 2;
const ALPHA: f64 = 0.2;
const BETA: f64 = 2.0;
const K_START: f64 = 0.2;
const K_END: f64 = 0.005;
const K_FACTOR: f64 = 0.99;
const ITERATIONS_PER_K: usize = 25;
const THREADS: usize = 8;

fn main() {
    let dir = "src/bin/tsp2000";
    let raw = load_points("HW9_TSP_2000.txt");
    let d = point_distances(&raw);
    // Coordinates scaled to the unit square.
    let pts: Vec<(f64, f64)> = raw.iter().map(|&(x, y)| (x / 1999.0, y / 1999.0)).collect();
    let n = pts.len();
    let m = RING_FACTOR * n;
    // The ring starts as a small circle around the centre of the cities.
    let (cx, cy) = (pts.iter().map(|p| p.0).sum::<f64>() / n as f64, pts.iter().map(|p| p.1).sum::<f64>() / n as f64);
    let mut ring: Vec<(f64, f64)> = (0..m).map(|j| {
        let a = TAU * j as f64 / m as f64;
        (cx + 0.1 * a.cos(), cy + 0.1 * a.sin())
    }).collect();

    let t = Instant::now();
    let mut k = K_START;
    let mut iterations = 0;
    let mut trace = Vec::new();
    // Outer loop: the "temperature" k slowly decreases.
    while k > K_END {
        for _ in 0..ITERATIONS_PER_K {
            iterations += 1;
            let scale = 1.0 / (2.0 * k * k);
            // Map step: forces of the cities on the ring, computed in parallel.
            let force: Vec<(f64, f64)> = std::thread::scope(|s| {
                let handles: Vec<_> = (0..THREADS).map(|part| {
                    // Both vectors are only read during this step, so the
                    // threads can share plain references to them.
                    let (pts, ring) = (&pts, &ring);
                    s.spawn(move || {
                        // Private accumulators: each thread writes only to
                        // its own buffers, so there are no data races and
                        // no locks.
                        let mut local = vec![(0.0, 0.0); m];
                        let mut weight = vec![0.0; m];
                        // Thread `part` takes every THREADS-th city.
                        for p in pts.iter().skip(part).step_by(THREADS) {
                            // Gaussian weight of every ring point for city p.
                            let mut total = 0.0;
                            for (j, y) in ring.iter().enumerate() {
                                let (dx, dy) = (p.0 - y.0, p.1 - y.1);
                                let v = (-(dx * dx + dy * dy) * scale).exp();
                                weight[j] = v;
                                total += v;
                            }
                            // Normalised weights pull ring points towards p.
                            if total > 0.0 {
                                for (j, y) in ring.iter().enumerate() {
                                    let w = weight[j] / total;
                                    local[j].0 += w * (p.0 - y.0);
                                    local[j].1 += w * (p.1 - y.1);
                                }
                            }
                        }
                        local
                    })
                }).collect();
                // Reduce step on the calling thread: sum the partial forces.
                let mut sum = vec![(0.0, 0.0); m];
                for h in handles {
                    for (a, b) in sum.iter_mut().zip(h.join().unwrap()) {
                        a.0 += b.0;
                        a.1 += b.1;
                    }
                }
                sum
            });
            // Sequential update: city force plus elastic force between ring
            // neighbours. All threads have finished, so `ring` can be mutated
            // again (the borrow checker enforces this).
            let old = ring.clone();
            for j in 0..m {
                let (l, r) = (old[(j + m - 1) % m], old[(j + 1) % m]);
                ring[j].0 += ALPHA * force[j].0 + BETA * k * (l.0 - 2.0 * old[j].0 + r.0);
                ring[j].1 += ALPHA * force[j].1 + BETA * k * (l.1 - 2.0 * old[j].1 + r.1);
            }
        }
        k *= K_FACTOR;
        trace.push(k);
    }
    let seconds = t.elapsed().as_secs_f64();

    // Read the tour off the ring: sort cities by their nearest ring point.
    let mut keyed: Vec<(usize, f64, usize)> = pts.iter().enumerate().map(|(i, p)| {
        let (j, dist) = ring.iter().enumerate().map(|(j, y)| (j, (p.0 - y.0).powi(2) + (p.1 - y.1).powi(2))).min_by(|a, b| a.1.total_cmp(&b.1)).unwrap();
        (j, dist, i)
    }).collect();
    let worst = keyed.iter().map(|x| x.1.sqrt() * 1999.0).fold(0.0, f64::max);
    keyed.sort_by(|a, b| a.0.cmp(&b.0).then(a.2.cmp(&b.2)));
    let tour: Vec<usize> = keyed.iter().map(|x| x.2).collect();
    let length = tour_length(&d, &tour);
    println!("elastic net: {length:.6}, {iterations} iterations, {seconds:.1}s, farthest point from ring {worst:.1}, K steps {}", trace.len());
    save_ids(&tour, &format!("{dir}/HW9_B2_elastic.txt"));
    std::fs::write(format!("{dir}/HW9_B2_elastic_results.json"), serde_json::to_string_pretty(&json!({
        "method": "elastic net (Durbin-Willshaw), points ordered by their nearest ring node",
        "ring_nodes": m, "alpha": ALPHA, "beta": BETA, "k_start": K_START, "k_end": K_END, "k_factor": K_FACTOR, "iterations_per_k": ITERATIONS_PER_K,
        "iterations": iterations, "seconds": seconds, "length": length, "farthest_point_from_ring": worst,
    })).unwrap()).unwrap();
}
