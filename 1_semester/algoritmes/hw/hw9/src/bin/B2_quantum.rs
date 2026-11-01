use std::time::Instant;

use serde_json::json;

use hw9::*;

const MOVES: u64 = 1_000_000_000;
const POLISH: u64 = 50_000_000;
const REPLICAS: usize = 20;
const TAU: f64 = 5.0;
const GAMMA_START: f64 = 300.0;
const GAMMA_END: f64 = 0.01;
const CANDIDATES: usize = 10;

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

#[derive(Clone)]
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
    fn has(&self, a: usize, b: usize) -> bool {
        self.succ(a) == b || self.pred(a) == b
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

enum Move {
    TwoOpt(usize, usize, usize, usize),
    Insert(usize, usize, usize, usize, usize, usize),
}

fn propose(t: &Tour, d: &[Vec<f64>], neigh: &[Vec<usize>], rng: &mut Rng) -> Option<(Move, f64, Vec<(usize, usize)>, Vec<(usize, usize)>)> {
    let n = d.len();
    let a = rng.below(n);
    let c = neigh[a][rng.below(CANDIDATES)];
    if rng.next() & 1 == 0 {
        let forward = rng.next() & 1 == 0;
        let (b, e) = if forward { (t.succ(a), t.succ(c)) } else { (t.pred(a), t.pred(c)) };
        if b == c || e == a {
            return None;
        }
        let delta = d[a][c] + d[b][e] - d[a][b] - d[c][e];
        let m = if forward { Move::TwoOpt(a, b, c, e) } else { Move::TwoOpt(b, a, e, c) };
        Some((m, delta, vec![(a, c), (b, e)], vec![(a, b), (c, e)]))
    } else {
        let len = 1 + rng.below(3);
        let f = a;
        let mut l = f;
        for _ in 1..len {
            l = t.succ(l);
        }
        let (p, q, e) = (t.pred(f), t.succ(l), t.succ(c));
        let mut inside = false;
        let mut walk = f;
        for _ in 0..len {
            inside |= walk == c || walk == e;
            walk = t.succ(walk);
        }
        if inside || c == p || e == p || p == q {
            return None;
        }
        let delta = d[p][q] + d[c][f] + d[l][e] - d[p][f] - d[l][q] - d[c][e];
        Some((Move::Insert(p, f, l, q, c, e), delta, vec![(p, q), (c, f), (l, e)], vec![(p, f), (l, q), (c, e)]))
    }
}

fn apply(t: &mut Tour, m: Move) {
    match m {
        Move::TwoOpt(a, b, c, e) => t.exchange(a, b, c, e),
        Move::Insert(p, f, l, q, c, e) => {
            t.exchange(p, f, c, e);
            if c != q {
                t.exchange(p, c, q, l);
            }
            t.exchange(c, l, f, e);
        }
    }
}

fn simulate(d: &[Vec<f64>], neigh: &[Vec<usize>], start: &[usize], seed: u64) -> (Vec<usize>, f64, f64, Vec<(f64, f64, f64)>) {
    let mut rng = Rng(seed);
    let mut reps: Vec<Tour> = (0..REPLICAS).map(|_| Tour::new(start.to_vec())).collect();
    let step = 1_000_000u64;
    let factor = (GAMMA_END / GAMMA_START).powf(step as f64 / MOVES as f64);
    let mut gamma = GAMMA_START;
    let mut coupling = -(TAU / 2.0) * (gamma / TAU).tanh().ln();
    let mut trace = Vec::new();
    for m in 0..MOVES {
        if m % step == 0 && m > 0 {
            gamma *= factor;
            coupling = -(TAU / 2.0) * (gamma / TAU).tanh().ln();
            if m % (MOVES / 10) == 0 {
                let lengths: Vec<f64> = reps.iter().map(|r| tour_length(d, &r.order)).collect();
                trace.push((gamma, lengths.iter().cloned().fold(f64::MAX, f64::min), coupling));
            }
        }
        let k = (m % REPLICAS as u64) as usize;
        let Some((mv, delta, added, removed)) = propose(&reps[k], d, neigh, &mut rng) else { continue };
        let (left, right) = ((k + REPLICAS - 1) % REPLICAS, (k + 1) % REPLICAS);
        let mut shared = 0i32;
        for &(x, y) in &added {
            shared += reps[left].has(x, y) as i32 + reps[right].has(x, y) as i32;
        }
        for &(x, y) in &removed {
            shared -= reps[left].has(x, y) as i32 + reps[right].has(x, y) as i32;
        }
        let energy = delta - coupling * shared as f64;
        if energy <= 0.0 || rng.unit() < (-energy / TAU).exp() {
            apply(&mut reps[k], mv);
        }
    }
    let lengths: Vec<f64> = reps.iter().map(|r| tour_length(d, &r.order)).collect();
    let spread = lengths.iter().cloned().fold(f64::MIN, f64::max) - lengths.iter().cloned().fold(f64::MAX, f64::min);
    let best = lengths.iter().enumerate().min_by(|a, b| a.1.total_cmp(b.1)).unwrap().0;
    let before = lengths[best];
    let mut t = reps[best].clone();
    for _ in 0..POLISH {
        if let Some((mv, delta, _, _)) = propose(&t, d, neigh, &mut rng) {
            if delta < -1e-9 {
                apply(&mut t, mv);
            }
        }
    }
    trace.push((gamma, before, spread));
    let length = tour_length(d, &t.order);
    (t.order, length, before, trace)
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
    let start: Vec<usize> = std::fs::read_to_string(format!("{dir}/HW9_B2_hungarian.txt")).unwrap().split_whitespace().map(|x| x.parse::<usize>().unwrap() - 1).collect();

    let runs: Vec<(u64, Vec<usize>, f64, f64, Vec<(f64, f64, f64)>, f64)> = std::thread::scope(|s| {
        let handles: Vec<_> = [1u64, 2, 3].map(|seed| {
            let (d, neigh, start) = (&d, &neigh, &start);
            s.spawn(move || {
                let t = Instant::now();
                let (tour, length, before, trace) = simulate(d, neigh, start, seed);
                let mut check = tour.clone();
                check.sort_unstable();
                assert!(check.iter().enumerate().all(|(i, &c)| i == c));
                (seed, tour, length, before, trace, t.elapsed().as_secs_f64())
            })
        }).into_iter().collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    for (seed, _, length, before, trace, seconds) in &runs {
        println!("seed {seed}: {length:.3} (before polish {before:.3}) in {seconds:.1}s; best replica over time {:?}", trace.iter().map(|p| p.1.round()).collect::<Vec<_>>());
    }
    let best = runs.iter().min_by(|a, b| a.2.total_cmp(&b.2)).unwrap();
    println!("best {:.6}", best.2);
    save_ids(&best.1, &format!("{dir}/HW9_B2_quantum.txt"));
    std::fs::write(format!("{dir}/HW9_B2_quantum_results.json"), serde_json::to_string_pretty(&json!({
        "method": "simulated quantum annealing (path-integral style): replicas on a ring, coupled by shared edges, with a final descent on the best replica",
        "moves": MOVES, "polish_moves": POLISH, "replicas": REPLICAS, "tau": TAU, "gamma_start": GAMMA_START, "gamma_end": GAMMA_END, "candidates": CANDIDATES,
        "length": best.2,
        "runs": runs.iter().map(|r| json!({"seed": r.0, "length": r.2, "before_polish": r.3, "seconds": r.5})).collect::<Vec<_>>(),
    })).unwrap()).unwrap();
}
