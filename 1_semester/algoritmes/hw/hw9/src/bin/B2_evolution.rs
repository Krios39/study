use std::time::Instant;

use serde_json::json;

use hw9::*;

const POPULATION: usize = 50;
const CANDIDATES: usize = 10;
const SECONDS: f64 = 300.0;

struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
}

fn reverse(order: &mut [usize], pos: &mut [usize], from: usize, to: usize) {
    let n = order.len();
    let inner = (to + n - from) % n + 1;
    let (mut i, mut j, count) = if inner * 2 <= n { (from, to, inner / 2) } else { ((to + 1) % n, (from + n - 1) % n, (n - inner) / 2) };
    for _ in 0..count {
        let (a, b) = (order[i], order[j]);
        order[i] = b;
        order[j] = a;
        pos[b] = i;
        pos[a] = j;
        i = (i + 1) % n;
        j = (j + n - 1) % n;
    }
}

fn local_search(d: &[Vec<f64>], neigh: &[Vec<usize>], tour: &mut Vec<usize>) {
    let n = tour.len();
    let mut pos = vec![0; n];
    for (i, &c) in tour.iter().enumerate() {
        pos[c] = i;
    }
    let mut queue: Vec<usize> = tour.clone();
    let mut waiting = vec![true; n];
    while let Some(a) = queue.pop() {
        waiting[a] = false;
        let mut improved = false;
        'search: for &c in &neigh[a][..CANDIDATES] {
            for forward in [true, false] {
                let step = |x: usize, pos: &[usize], order: &[usize]| if forward { order[(pos[x] + 1) % n] } else { order[(pos[x] + n - 1) % n] };
                let (b, e) = (step(a, &pos, tour), step(c, &pos, tour));
                if b == c || e == a || d[a][c] >= d[a][b] {
                    continue;
                }
                let delta = d[a][c] + d[b][e] - d[a][b] - d[c][e];
                if delta < -1e-9 {
                    if forward {
                        let (from, to) = (pos[b], pos[c]);
                        reverse(tour, &mut pos, from, to);
                    } else {
                        let (from, to) = (pos[c], pos[b]);
                        reverse(tour, &mut pos, from, to);
                    }
                    for x in [a, b, c, e] {
                        if !waiting[x] {
                            waiting[x] = true;
                            queue.push(x);
                        }
                    }
                    improved = true;
                    break 'search;
                }
            }
        }
        if improved {
            continue;
        }
        'insert: for &c in &neigh[a][..CANDIDATES] {
            let e = tour[(pos[c] + 1) % n];
            let (p, q) = (tour[(pos[a] + n - 1) % n], tour[(pos[a] + 1) % n]);
            if c == a || e == a || c == p {
                continue 'insert;
            }
            let delta = d[p][q] + d[c][a] + d[a][e] - d[p][a] - d[a][q] - d[c][e];
            if delta < -1e-9 {
                let from = pos[a];
                let to = pos[c];
                let mut i = from;
                while i != to {
                    let j = (i + 1) % n;
                    tour[i] = tour[j];
                    pos[tour[i]] = i;
                    i = j;
                }
                tour[to] = a;
                pos[a] = to;
                for x in [a, p, q, c, e] {
                    if !waiting[x] {
                        waiting[x] = true;
                        queue.push(x);
                    }
                }
                break 'insert;
            }
        }
    }
}

fn crossover(d: &[Vec<f64>], full: &[Vec<usize>], a: &[usize], b: &[usize], rng: &mut Rng) -> Vec<usize> {
    let n = a.len();
    let links = |t: &[usize]| {
        let mut l = vec![(0, 0); n];
        for i in 0..n {
            l[t[i]] = (t[(i + n - 1) % n], t[(i + 1) % n]);
        }
        l
    };
    let (la, lb) = (links(a), links(b));
    let mut seen = vec![false; n];
    let mut u = rng.below(n);
    let mut child = vec![u];
    seen[u] = true;
    while child.len() < n {
        let options = [la[u].0, la[u].1, lb[u].0, lb[u].1];
        let next = options.iter().copied().filter(|&v| !seen[v]).min_by(|&x, &y| d[u][x].total_cmp(&d[u][y]))
            .unwrap_or_else(|| *full[u].iter().find(|&&v| !seen[v]).unwrap());
        seen[next] = true;
        child.push(next);
        u = next;
    }
    child
}

fn evolve(d: &[Vec<f64>], full: &[Vec<usize>], seed: u64) -> (Vec<usize>, f64, usize, Vec<(f64, f64)>, f64) {
    let n = d.len();
    let mut rng = Rng(seed);
    let mut population: Vec<(f64, Vec<usize>)> = (0..POPULATION).map(|_| {
        let mut seen = vec![false; n];
        let mut u = rng.below(n);
        let mut tour = vec![u];
        seen[u] = true;
        while tour.len() < n {
            let open: Vec<usize> = full[u].iter().copied().filter(|&v| !seen[v]).take(3).collect();
            u = open[rng.below(open.len())];
            seen[u] = true;
            tour.push(u);
        }
        local_search(d, full, &mut tour);
        (tour_length(d, &tour), tour)
    }).collect();
    let first_best = population.iter().map(|p| p.0).fold(f64::MAX, f64::min);
    let t = Instant::now();
    let mut generations = 0;
    let mut trace = Vec::new();
    let mut next_mark = 60.0;
    while t.elapsed().as_secs_f64() < SECONDS {
        generations += 1;
        let pick = |rng: &mut Rng, population: &[(f64, Vec<usize>)]| {
            let (x, y) = (rng.below(POPULATION), rng.below(POPULATION));
            if population[x].0 < population[y].0 { x } else { y }
        };
        let (x, y) = (pick(&mut rng, &population), pick(&mut rng, &population));
        if x == y {
            continue;
        }
        let mut child = crossover(d, full, &population[x].1, &population[y].1, &mut rng);
        local_search(d, full, &mut child);
        let length = tour_length(d, &child);
        let worst = (0..POPULATION).max_by(|&a, &b| population[a].0.total_cmp(&population[b].0)).unwrap();
        if length < population[worst].0 && population.iter().all(|p| (p.0 - length).abs() > 1e-6) {
            population[worst] = (length, child);
        }
        if t.elapsed().as_secs_f64() > next_mark {
            trace.push((next_mark, population.iter().map(|p| p.0).fold(f64::MAX, f64::min)));
            next_mark += 60.0;
        }
    }
    let best = population.into_iter().min_by(|a, b| a.0.total_cmp(&b.0)).unwrap();
    (best.1, best.0, generations, trace, first_best)
}

fn main() {
    let dir = "src/bin/tsp2000";
    let d = point_distances(&load_points("HW9_TSP_2000.txt"));
    let n = d.len();
    let full: Vec<Vec<usize>> = (0..n).map(|u| {
        let mut l: Vec<usize> = (0..n).filter(|&v| v != u).collect();
        l.sort_by(|&a, &b| d[u][a].total_cmp(&d[u][b]).then(a.cmp(&b)));
        l
    }).collect();
    let runs: Vec<(u64, (Vec<usize>, f64, usize, Vec<(f64, f64)>, f64))> = std::thread::scope(|s| {
        let handles: Vec<_> = [1u64, 2, 3].map(|seed| {
            let (d, full) = (&d, &full);
            s.spawn(move || (seed, evolve(d, full, seed)))
        }).into_iter().collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    for (seed, r) in &runs {
        let mut check = r.0.clone();
        check.sort_unstable();
        assert!(check.iter().enumerate().all(|(i, &c)| i == c));
        println!("seed {seed}: first population best {:.0}, final {:.3}, {} generations, by minute {:?}", r.4, r.1, r.2, r.3.iter().map(|p| p.1.round()).collect::<Vec<_>>());
    }
    let best = runs.iter().min_by(|a, b| a.1.1.total_cmp(&b.1.1)).unwrap();
    println!("best {:.6}", best.1.1);
    save_ids(&best.1.0, &format!("{dir}/HW9_B2_evolution.txt"));
    std::fs::write(format!("{dir}/HW9_B2_evolution_results.json"), serde_json::to_string_pretty(&json!({
        "method": "steady-state memetic algorithm: tournament parents, edge-preserving crossover, 2-opt and single-point insertion local search",
        "population": POPULATION, "candidates": CANDIDATES, "seconds_per_seed": SECONDS, "length": best.1.1,
        "runs": runs.iter().map(|(seed, r)| json!({"seed": seed, "length": r.1, "generations": r.2, "first_population_best": r.4})).collect::<Vec<_>>(),
    })).unwrap()).unwrap();
}
