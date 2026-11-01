use std::time::Instant;

use serde_json::json;

use hw9::*;

const ANTS: usize = 10;
const CANDIDATES: usize = 20;
const BETA: i32 = 2;
const Q0: f64 = 0.9;
const RHO: f64 = 0.1;
const XI: f64 = 0.1;
const SECONDS: f64 = 120.0;

struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    fn unit(&mut self) -> f64 {
        (self.next() >> 11) as f64 / (1u64 << 53) as f64
    }
}

fn colony(d: &[Vec<f64>], neigh: &[Vec<usize>], seed: u64) -> (Vec<usize>, f64, usize, Vec<(f64, f64)>) {
    let n = d.len();
    let mut rng = Rng(seed);
    let nn = {
        let mut seen = vec![false; n];
        let mut tour = vec![0];
        seen[0] = true;
        while tour.len() < n {
            let u = *tour.last().unwrap();
            let w = *neigh[u].iter().find(|&&w| !seen[w]).unwrap();
            seen[w] = true;
            tour.push(w);
        }
        tour_length(d, &tour)
    };
    let tau0 = 1.0 / (n as f64 * nn);
    let mut tau = vec![vec![tau0; n]; n];
    let eta: Vec<Vec<f64>> = d.iter().map(|r| r.iter().map(|&x| if x > 0.0 { (1.0 / x).powi(BETA) } else { 0.0 }).collect()).collect();
    let mut best = Vec::new();
    let mut best_len = f64::INFINITY;
    let mut trace = Vec::new();
    let mut iterations = 0;
    let t = Instant::now();
    let mut seen = vec![0usize; n];
    let mut stamp = 0;
    while t.elapsed().as_secs_f64() < SECONDS {
        iterations += 1;
        for _ in 0..ANTS {
            stamp += 1;
            let start = (rng.next() % n as u64) as usize;
            let mut tour = Vec::with_capacity(n);
            tour.push(start);
            seen[start] = stamp;
            let mut u = start;
            while tour.len() < n {
                let open: Vec<usize> = neigh[u][..CANDIDATES].iter().copied().filter(|&w| seen[w] != stamp).collect();
                let w = if open.is_empty() {
                    *neigh[u].iter().find(|&&w| seen[w] != stamp).unwrap()
                } else if rng.unit() < Q0 {
                    *open.iter().max_by(|&&a, &&b| (tau[u][a] * eta[u][a]).total_cmp(&(tau[u][b] * eta[u][b]))).unwrap()
                } else {
                    let total: f64 = open.iter().map(|&w| tau[u][w] * eta[u][w]).sum();
                    let mut left = rng.unit() * total;
                    let mut chosen = open[open.len() - 1];
                    for &w in &open {
                        left -= tau[u][w] * eta[u][w];
                        if left <= 0.0 {
                            chosen = w;
                            break;
                        }
                    }
                    chosen
                };
                let value = (1.0 - XI) * tau[u][w] + XI * tau0;
                tau[u][w] = value;
                tau[w][u] = value;
                seen[w] = stamp;
                tour.push(w);
                u = w;
            }
            let length = tour_length(d, &tour);
            if length < best_len {
                best_len = length;
                best = tour;
                trace.push((t.elapsed().as_secs_f64(), best_len));
            }
        }
        for i in 0..n {
            let (a, b) = (best[i], best[(i + 1) % n]);
            let value = (1.0 - RHO) * tau[a][b] + RHO / best_len;
            tau[a][b] = value;
            tau[b][a] = value;
        }
    }
    (best, best_len, iterations, trace)
}

fn main() {
    let dir = "src/bin/tsp2000";
    let points = load_points("HW9_TSP_2000.txt");
    let d = point_distances(&points);
    let n = d.len();
    let neigh: Vec<Vec<usize>> = (0..n).map(|u| {
        let mut l: Vec<usize> = (0..n).filter(|&v| v != u).collect();
        l.sort_by(|&a, &b| d[u][a].total_cmp(&d[u][b]).then(a.cmp(&b)));
        l
    }).collect();

    let runs: Vec<(u64, (Vec<usize>, f64, usize, Vec<(f64, f64)>))> = std::thread::scope(|s| {
        let handles: Vec<_> = [1u64, 2, 3].map(|seed| {
            let (d, neigh) = (&d, &neigh);
            s.spawn(move || (seed, colony(d, neigh, seed)))
        }).into_iter().collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    for (seed, (_, length, iterations, trace)) in &runs {
        let at = |limit: f64| trace.iter().take_while(|p| p.0 <= limit).last().map_or(f64::NAN, |p| p.1);
        println!("seed {seed}: {length:.3}, {iterations} iterations; at 10s {:.0}, 30s {:.0}, 60s {:.0}", at(10.0), at(30.0), at(60.0));
    }
    let (_, (best, length, _, _)) = runs.iter().min_by(|a, b| a.1.1.total_cmp(&b.1.1)).unwrap();
    println!("best {length:.6}");
    save_ids(best, &format!("{dir}/HW9_B2_ant.txt"));
    std::fs::write(format!("{dir}/HW9_B2_ant_results.json"), serde_json::to_string_pretty(&json!({
        "method": "Ant Colony System without local search",
        "ants": ANTS, "candidates": CANDIDATES, "beta": BETA, "q0": Q0, "rho": RHO, "xi": XI, "seconds_per_seed": SECONDS,
        "length": length,
        "runs": runs.iter().map(|(seed, r)| json!({"seed": seed, "length": r.1, "iterations": r.2})).collect::<Vec<_>>(),
    })).unwrap()).unwrap();
}
