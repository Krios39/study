use std::time::Instant;

use serde_json::json;

use hw9::*;

const CANDIDATES: usize = 8;
const FIRST_LEVEL: usize = 5;
const MAX_DEPTH: usize = 50;
const SEGMENT: usize = 50;
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

fn chain(t: &mut Tour, d: &[Vec<f64>], neigh: &[Vec<usize>], t1: usize, start: usize, first: usize, touched: &mut Vec<usize>) -> f64 {
    let mut t2 = start;
    let mut gain = d[t1][t2];
    let mut total = 0.0;
    let mut moves: Vec<(usize, usize, usize, usize)> = Vec::new();
    let mut added: Vec<(usize, usize)> = Vec::new();
    let (mut best, mut best_len) = (0.0, 0);
    for depth in 0..MAX_DEPTH {
        let forward = t.succ(t1) == t2;
        let before = |t: &Tour, x: usize| if forward { t.pred(x) } else { t.succ(x) };
        let mut options: Vec<(f64, usize, usize)> = Vec::new();
        for &t3 in &neigh[t2] {
            if t3 == t1 {
                continue;
            }
            let t4 = before(t, t3);
            if t4 == t2 || gain - d[t2][t3] <= 1e-9 {
                continue;
            }
            if added.iter().any(|&(x, y)| (x == t3 && y == t4) || (x == t4 && y == t3)) {
                continue;
            }
            options.push((d[t4][t3] - d[t2][t3], t3, t4));
        }
        options.sort_by(|a, b| b.0.total_cmp(&a.0));
        let pick = if depth == 0 { first } else { 0 };
        let Some(&(_, t3, t4)) = options.get(pick) else { break };
        t.exchange(t1, t2, t4, t3);
        moves.push((t1, t2, t4, t3));
        added.push((t2, t3));
        gain += d[t4][t3] - d[t2][t3];
        total = gain - d[t4][t1];
        if total > best + 1e-9 {
            best = total;
            best_len = moves.len();
        }
        t2 = t4;
    }
    let _ = total;
    while moves.len() > best_len {
        let (a, b, c, e) = moves.pop().unwrap();
        t.exchange(a, c, b, e);
    }
    for &(a, b, c, e) in &moves {
        touched.extend([a, b, c, e]);
    }
    best
}

fn optimise(t: &mut Tour, d: &[Vec<f64>], neigh: &[Vec<usize>], queue: &mut Vec<usize>, waiting: &mut [bool]) -> f64 {
    let mut saved = 0.0;
    let mut touched = Vec::new();
    while let Some(t1) = queue.pop() {
        waiting[t1] = false;
        let mut improved = false;
        'search: for side in 0..2 {
            for first in 0..FIRST_LEVEL {
                let start = if side == 0 { t.succ(t1) } else { t.pred(t1) };
                touched.clear();
                let gain = chain(t, d, neigh, t1, start, first, &mut touched);
                if gain > 1e-9 {
                    saved += gain;
                    improved = true;
                    break 'search;
                }
            }
        }
        if improved {
            for &x in &touched {
                if !waiting[x] {
                    waiting[x] = true;
                    queue.push(x);
                }
            }
            if !waiting[t1] {
                waiting[t1] = true;
                queue.push(t1);
            }
        }
    }
    saved
}

fn kick(t: &mut Tour, d: &[Vec<f64>], rng: &mut Rng, queue: &mut Vec<usize>, waiting: &mut [bool]) -> f64 {
    let n = t.order.len();
    let p = rng.below(n);
    let (la, lb) = (1 + rng.below(SEGMENT), 1 + rng.below(SEGMENT));
    let at = |t: &Tour, k: usize| t.order[(p + k) % n];
    let (a, b, c, e, f, g) = (at(t, 0), at(t, 1), at(t, la), at(t, la + 1), at(t, la + lb), at(t, la + lb + 1));
    let delta = d[a][e] + d[f][b] + d[c][g] - d[a][b] - d[c][e] - d[f][g];
    let first: Vec<usize> = (1..=la).map(|k| at(t, k)).collect();
    let second: Vec<usize> = (la + 1..=la + lb).map(|k| at(t, k)).collect();
    for (k, &x) in second.iter().chain(first.iter()).enumerate() {
        let i = (p + 1 + k) % n;
        t.order[i] = x;
        t.pos[x] = i;
    }
    for x in [a, b, c, e, f, g] {
        if !waiting[x] {
            waiting[x] = true;
            queue.push(x);
        }
    }
    delta
}

struct Outcome {
    name: String,
    tour: Vec<usize>,
    start: f64,
    after_lk: f64,
    lk_seconds: f64,
    length: f64,
    kicks: usize,
    trace: Vec<f64>,
}

fn run(d: &[Vec<f64>], neigh: &[Vec<usize>], start: Vec<usize>, seed: u64, name: String, seconds: f64) -> Outcome {
    let n = d.len();
    let mut rng = Rng(seed);
    let start_len = tour_length(d, &start);
    let mut t = Tour::new(start);
    let mut queue: Vec<usize> = (0..n).collect();
    let mut waiting = vec![true; n];
    let clock = Instant::now();
    optimise(&mut t, d, neigh, &mut queue, &mut waiting);
    let lk_seconds = clock.elapsed().as_secs_f64();
    let mut length = tour_length(d, &t.order);
    let after_lk = length;
    let mut backup = t.clone();
    let mut kicks = 0;
    let mut trace = Vec::new();
    let mut mark = 60.0;
    let clock = Instant::now();
    while clock.elapsed().as_secs_f64() < seconds {
        kicks += 1;
        let delta = kick(&mut t, d, &mut rng, &mut queue, &mut waiting);
        let saved = optimise(&mut t, d, neigh, &mut queue, &mut waiting);
        let change = delta - saved;
        if change <= 1e-9 {
            length += change;
            backup.order.copy_from_slice(&t.order);
            backup.pos.copy_from_slice(&t.pos);
        } else {
            t.order.copy_from_slice(&backup.order);
            t.pos.copy_from_slice(&backup.pos);
        }
        if clock.elapsed().as_secs_f64() > mark {
            trace.push(length);
            mark += 60.0;
        }
    }
    let length = tour_length(d, &backup.order);
    Outcome { name, tour: backup.order, start: start_len, after_lk, lk_seconds, length, kicks, trace }
}

fn main() {
    let dir = "src/bin/tsp2000";
    let d = point_distances(&load_points("HW9_TSP_2000.txt"));
    let n = d.len();
    let neigh: Vec<Vec<usize>> = (0..n).map(|u| {
        let mut l: Vec<usize> = (0..n).filter(|&v| v != u).collect();
        l.sort_by(|&a, &b| d[u][a].total_cmp(&d[u][b]).then(a.cmp(&b)));
        l.truncate(CANDIDATES);
        l
    }).collect();
    let args: Vec<String> = std::env::args().collect();
    if args.len() == 5 {
        let (rounds, round_seconds, threads): (usize, f64, usize) = (args[2].parse().unwrap(), args[3].parse().unwrap(), args[4].parse().unwrap());
        let mut best: Vec<usize> = std::fs::read_to_string(format!("{dir}/{}", args[1])).unwrap().split_whitespace().map(|x| x.parse::<usize>().unwrap() - 1).collect();
        let mut rounds_log = Vec::new();
        println!("start {:.6}", tour_length(&d, &best));
        for round in 0..rounds {
            let outcomes: Vec<Outcome> = std::thread::scope(|s| {
                let handles: Vec<_> = (0..threads).map(|k| {
                    let (d, neigh, start) = (&d, &neigh, best.clone());
                    s.spawn(move || run(d, neigh, start, (1000 * round + k + 1) as u64, format!("round{round}_thread{k}"), round_seconds))
                }).collect();
                handles.into_iter().map(|h| h.join().unwrap()).collect()
            });
            let top = outcomes.iter().min_by(|a, b| a.length.total_cmp(&b.length)).unwrap();
            println!("round {round}: best {:.6}, worst {:.6}, kicks {}", top.length, outcomes.iter().map(|o| o.length).fold(f64::MIN, f64::max), outcomes.iter().map(|o| o.kicks).sum::<usize>());
            let mut check = top.tour.clone();
            check.sort_unstable();
            assert!(check.iter().enumerate().all(|(i, &c)| i == c));
            best = top.tour.clone();
            rounds_log.push(json!({"round": round, "lengths": outcomes.iter().map(|o| o.length).collect::<Vec<_>>()}));
            save_ids(&best, &format!("{dir}/HW9_B2_lk_long.txt"));
            std::fs::write(format!("{dir}/HW9_B2_lk_long_results.json"), serde_json::to_string_pretty(&json!({
                "method": "iterated Lin-Kernighan style chains, all threads restart from the best tour after every round",
                "start": args[1], "threads": threads, "round_seconds": round_seconds, "length": tour_length(&d, &best), "rounds": rounds_log,
            })).unwrap()).unwrap();
        }
        return;
    }
    let read = |file: &str| -> Vec<usize> { std::fs::read_to_string(format!("{dir}/{file}")).unwrap().split_whitespace().map(|x| x.parse::<usize>().unwrap() - 1).collect() };
    let baseline: Vec<usize> = std::fs::read_to_string("HW9_TSP_baseline_tour.txt").unwrap().split_whitespace().map(|x| x.parse::<usize>().unwrap() - 1).collect();
    let jobs = vec![
        (baseline.clone(), 1u64, "nn_seed1".to_string()),
        (baseline.clone(), 2, "nn_seed2".to_string()),
        (baseline, 3, "nn_seed3".to_string()),
        (read("HW9_B2_anneal_from_ant.txt"), 1, "anneal_seed1".to_string()),
    ];
    let outcomes: Vec<Outcome> = std::thread::scope(|s| {
        let handles: Vec<_> = jobs.into_iter().map(|(start, seed, name)| {
            let (d, neigh) = (&d, &neigh);
            s.spawn(move || run(d, neigh, start, seed, name, SECONDS))
        }).collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    for o in &outcomes {
        let mut check = o.tour.clone();
        check.sort_unstable();
        assert!(check.iter().enumerate().all(|(i, &c)| i == c));
        println!("{}: start {:.3}, after LK {:.3} ({:.3}s), after {} kicks {:.6}, by minute {:?}", o.name, o.start, o.after_lk, o.lk_seconds, o.kicks, o.length, o.trace.iter().map(|x| x.round()).collect::<Vec<_>>());
    }
    let best = outcomes.iter().min_by(|a, b| a.length.total_cmp(&b.length)).unwrap();
    let best_nn = outcomes.iter().filter(|o| o.name.starts_with("nn")).min_by(|a, b| a.length.total_cmp(&b.length)).unwrap();
    println!("best {} {:.6}; best from NN {} {:.6}", best.name, best.length, best_nn.name, best_nn.length);
    save_ids(&best.tour, &format!("{dir}/HW9_B2_lk.txt"));
    save_ids(&best_nn.tour, &format!("{dir}/HW9_B2_lk_from_nn.txt"));
    std::fs::write(format!("{dir}/HW9_B2_lk_results.json"), serde_json::to_string_pretty(&json!({
        "method": "Lin-Kernighan style chains of 2-opt moves on neighbour lists, then iterated with local segment-swap kicks",
        "candidates": CANDIDATES, "first_level": FIRST_LEVEL, "max_depth": MAX_DEPTH, "segment": SEGMENT, "seconds": SECONDS,
        "best": {"run": best.name, "length": best.length},
        "runs": outcomes.iter().map(|o| json!({"run": o.name, "start": o.start, "after_lk": o.after_lk, "lk_seconds": o.lk_seconds, "length": o.length, "kicks": o.kicks, "by_minute": o.trace})).collect::<Vec<_>>(),
    })).unwrap()).unwrap();
}
