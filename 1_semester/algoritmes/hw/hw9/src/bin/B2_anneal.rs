use std::time::Instant;

use serde_json::json;

use hw9::*;

const MOVES: u64 = 1_000_000_000;
const T_START: f64 = 30.0;
const T_END: f64 = 0.3;
const CANDIDATES: usize = 10;
const SAVE_SECONDS: f64 = 10.0;

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
    fn unit(&mut self) -> f64 {
        (self.next() >> 11) as f64 / (1u64 << 53) as f64
    }
}

struct Tour {
    order: Vec<usize>,
    pos: Vec<usize>,
}

impl Tour {
    fn new(order: Vec<usize>) -> Self {
        let mut pos = vec![0; order.len()];
        for (i, &c) in order.iter().enumerate() {
            pos[c] = i;
        }
        Tour { order, pos }
    }
    fn succ(&self, c: usize) -> usize {
        self.order[(self.pos[c] + 1) % self.order.len()]
    }
    fn pred(&self, c: usize) -> usize {
        self.order[(self.pos[c] + self.order.len() - 1) % self.order.len()]
    }
    fn reverse(&mut self, from: usize, to: usize) {
        let n = self.order.len();
        let inner = (to + n - from) % n + 1;
        let (mut i, mut j, count) = if inner * 2 <= n {
            (from, to, inner / 2)
        } else {
            ((to + 1) % n, (from + n - 1) % n, (n - inner) / 2)
        };
        for _ in 0..count {
            let (a, b) = (self.order[i], self.order[j]);
            self.order[i] = b;
            self.order[j] = a;
            self.pos[b] = i;
            self.pos[a] = j;
            i = (i + 1) % n;
            j = (j + n - 1) % n;
        }
    }
    fn exchange(&mut self, a: usize, b: usize, c: usize, e: usize) {
        if self.succ(a) == b {
            self.reverse(self.pos[b], self.pos[c]);
        } else {
            self.reverse(self.pos[a], self.pos[e]);
        }
    }
}

fn anneal(d: &[Vec<f64>], neigh: &[Vec<usize>], start: &[usize], seed: u64, t_start: f64, moves: u64, best_file: &str) -> (Vec<usize>, Vec<(u64, f64)>, f64, Vec<usize>) {
    let n = d.len();
    let mut rng = Rng(seed);
    let mut t = Tour::new(start.to_vec());
    let mut length = tour_length(d, start);
    let mut trace = Vec::new();
    let step = 1_000_000u64;
    let factor = (T_END / t_start).powf(step as f64 / moves as f64);
    let mut temperature = t_start;
    let mut best = start.to_vec();
    let mut best_length = length;
    let mut unsaved = false;
    let mut saved_at = Instant::now();
    for m in 0..moves {
        if m % step == 0 && m > 0 {
            temperature *= factor;
            if m % (moves / 10) == 0 {
                trace.push((m, length));
            }
            if unsaved && saved_at.elapsed().as_secs_f64() >= SAVE_SECONDS {
                save_ids(&best, best_file);
                println!("seed {seed}: new best {best_length:.6} at move {m}");
                unsaved = false;
                saved_at = Instant::now();
            }
        }
        let a = rng.below(n);
        let c = neigh[a][rng.below(CANDIDATES)];
        if rng.next() & 1 == 0 {
            let forward = rng.next() & 1 == 0;
            let (b, e) = if forward { (t.succ(a), t.succ(c)) } else { (t.pred(a), t.pred(c)) };
            if b == c || e == a {
                continue;
            }
            let delta = d[a][c] + d[b][e] - d[a][b] - d[c][e];
            if delta <= 0.0 || rng.unit() < (-delta / temperature).exp() {
                if forward {
                    t.exchange(a, b, c, e);
                } else {
                    t.exchange(b, a, e, c);
                }
                length += delta;
                if length < best_length - 1e-7 {
                    best_length = length;
                    best.copy_from_slice(&t.order);
                    unsaved = true;
                }
            }
        } else {
            let len = 1 + rng.below(3);
            let f = a;
            let mut l = f;
            for _ in 1..len {
                l = t.succ(l);
            }
            let p = t.pred(f);
            let q = t.succ(l);
            let e = t.succ(c);
            let mut inside = false;
            let mut walk = f;
            for _ in 0..len {
                inside |= walk == c || walk == e;
                walk = t.succ(walk);
            }
            if inside || c == p || e == p || p == q {
                continue;
            }
            let delta = d[p][q] + d[c][f] + d[l][e] - d[p][f] - d[l][q] - d[c][e];
            if delta <= 0.0 || rng.unit() < (-delta / temperature).exp() {
                t.exchange(p, f, c, e);
                if c != q {
                    t.exchange(p, c, q, l);
                }
                t.exchange(c, l, f, e);
                length += delta;
                if length < best_length - 1e-7 {
                    best_length = length;
                    best.copy_from_slice(&t.order);
                    unsaved = true;
                }
            }
        }
    }
    if unsaved {
        save_ids(&best, best_file);
    }
    let last = tour_length(d, &t.order);
    (best, trace, last, t.order)
}

fn main() {
    let dir = "src/bin/tsp2000";
    let points = load_points("HW9_TSP_2000.txt");
    let d = point_distances(&points);
    let n = d.len();
    let neigh: Vec<Vec<usize>> = (0..n).map(|u| {
        let mut l: Vec<usize> = (0..n).filter(|&v| v != u).collect();
        l.sort_by(|&a, &b| d[u][a].total_cmp(&d[u][b]).then(a.cmp(&b)));
        l.truncate(CANDIDATES);
        l
    }).collect();
    let source = std::env::args().nth(1).unwrap_or("hungarian".to_string());
    let t_start: f64 = std::env::args().nth(2).map_or(T_START, |x| x.parse().unwrap());
    let moves: u64 = std::env::args().nth(3).map_or(MOVES, |x| x.parse().unwrap());
    let suffix = if source == "hungarian" { String::new() } else if t_start != T_START { format!("_from_{source}_T{t_start}") } else { format!("_from_{source}") };
    let start: Vec<usize> = std::fs::read_to_string(format!("{dir}/HW9_B2_{source}.txt")).unwrap().split_whitespace().map(|x| x.parse::<usize>().unwrap() - 1).collect();

    if let Some(count) = std::env::args().nth(4).map(|x| x.parse::<u64>().unwrap()) {
        std::fs::create_dir_all(format!("{dir}/pool")).unwrap();
        let threads = 12;
        std::thread::scope(|s| {
            for k in 0..threads {
                let (d, neigh, start, dir) = (&d, &neigh, &start, &dir);
                s.spawn(move || {
                    for seed in (1..=count).filter(|x| x % threads == k) {
                        let (_, _, last, tour) = anneal(d, neigh, start, seed, t_start, moves, &format!("{dir}/pool_unused_{k}.txt"));
                        save_ids(&tour, &format!("{dir}/pool/T{t_start}_seed{seed}.txt"));
                        println!("T {t_start} seed {seed}: {last:.6}");
                    }
                    let _ = std::fs::remove_file(format!("{dir}/pool_unused_{k}.txt"));
                });
            }
        });
        return;
    }

    let t = Instant::now();
    let runs: Vec<(u64, Vec<usize>, f64, Vec<(u64, f64)>, f64, f64)> = std::thread::scope(|s| {
        let handles: Vec<_> = [1u64, 2, 3].map(|seed| {
            let (d, neigh, start, suffix) = (&d, &neigh, &start, &suffix);
            s.spawn(move || {
                let t = Instant::now();
                let (tour, trace, last, _) = anneal(d, neigh, start, seed, t_start, moves, &format!("{dir}/HW9_B2_anneal{suffix}_seed{seed}_best.txt"));
                let mut check = tour.clone();
                check.sort_unstable();
                assert!(check.iter().enumerate().all(|(i, &c)| i == c));
                let length = tour_length(d, &tour);
                (seed, tour, length, trace, t.elapsed().as_secs_f64(), last)
            })
        }).into_iter().collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    for (seed, _, length, trace, seconds, last) in &runs {
        println!("seed {seed}: best {length:.3}, last {last:.3} in {seconds:.1}s; trace {:?}", trace.iter().map(|p| p.1.round()).collect::<Vec<_>>());
    }
    let best = runs.iter().min_by(|a, b| a.2.total_cmp(&b.2)).unwrap();
    println!("best {:.6}, total {:.1}s", best.2, t.elapsed().as_secs_f64());
    save_ids(&best.1, &format!("{dir}/HW9_B2_anneal{suffix}.txt"));
    std::fs::write(format!("{dir}/HW9_B2_anneal{suffix}_results.json"), serde_json::to_string_pretty(&json!({
        "method": "simulated annealing with 2-opt and segment insertion moves on neighbour lists, started from a given tour", "start": source,
        "moves": moves, "t_start": t_start, "t_end": T_END, "candidates": CANDIDATES, "length": best.2,
        "runs": runs.iter().map(|r| json!({"seed": r.0, "length": r.2, "last_length": r.5, "seconds": r.4})).collect::<Vec<_>>(),
    })).unwrap()).unwrap();
}
