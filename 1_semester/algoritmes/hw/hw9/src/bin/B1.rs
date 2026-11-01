use std::collections::BTreeMap;
use std::time::Instant;

use plotters::prelude::*;
use serde_json::json;

use hw9::*;

struct Disk {
    centre: usize,
    r2: i64,
    members: Vec<usize>,
}

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

fn sq(p: &[(i64, i64)], a: usize, b: usize) -> i64 {
    let (dx, dy) = (p[a].0 - p[b].0, p[a].1 - p[b].1);
    dx * dx + dy * dy
}

fn build_family(p: &[(i64, i64)], sizes: &[usize]) -> Vec<Disk> {
    let n = p.len();
    let mut seen: BTreeMap<(usize, i64), ()> = BTreeMap::new();
    for i in 0..n {
        let mut others: Vec<(i64, usize)> = (0..n).filter(|&j| j != i).map(|j| (sq(p, i, j), j)).collect();
        others.sort_unstable();
        for &k in sizes {
            seen.insert((i, others[k - 2].0), ());
        }
    }
    seen.into_keys().map(|(centre, r2)| {
        let members = (0..n).filter(|&j| sq(p, centre, j) <= r2).collect();
        Disk { centre, r2, members }
    }).collect()
}

fn weighted_greedy(n: usize, disks: &[Disk], containing: &[Vec<usize>]) -> Vec<usize> {
    let mut gain: Vec<usize> = disks.iter().map(|d| d.members.len()).collect();
    let mut covered = vec![false; n];
    let mut left = n;
    let mut chosen = Vec::new();
    while left > 0 {
        let mut best: Option<usize> = None;
        for c in 0..disks.len() {
            if gain[c] > 0 && best.map_or(true, |b| (gain[c] as i128) * (disks[b].r2 as i128) > (gain[b] as i128) * (disks[c].r2 as i128)) {
                best = Some(c);
            }
        }
        let b = best.unwrap();
        chosen.push(b);
        for &m in &disks[b].members {
            if !covered[m] {
                covered[m] = true;
                left -= 1;
                for &c in &containing[m] {
                    gain[c] -= 1;
                }
            }
        }
    }
    chosen
}

fn prune(n: usize, disks: &[Disk], cover: &[usize]) -> Vec<usize> {
    let mut count = vec![0usize; n];
    for &c in cover {
        disks[c].members.iter().for_each(|&m| count[m] += 1);
    }
    let mut by_cost = cover.to_vec();
    by_cost.sort_by_key(|&c| (std::cmp::Reverse(disks[c].r2), c));
    let mut kept = cover.to_vec();
    for c in by_cost {
        if disks[c].members.iter().all(|&m| count[m] > 1) {
            disks[c].members.iter().for_each(|&m| count[m] -= 1);
            kept.retain(|&x| x != c);
        }
    }
    kept
}

fn replacements(n: usize, disks: &[Disk], containing: &[Vec<usize>], inside: &[Vec<bool>], start: &[usize], history: &mut Vec<(&'static str, Vec<usize>)>) -> (Vec<usize>, usize, usize) {
    let mut cover = start.to_vec();
    let (mut moves, mut evaluated) = (0, 0);
    loop {
        let mut count = vec![0usize; n];
        for &c in &cover {
            disks[c].members.iter().for_each(|&m| count[m] += 1);
        }
        let mut best: Option<(i64, Vec<usize>, Option<usize>)> = None;
        let mut groups: Vec<Vec<usize>> = cover.iter().map(|&a| vec![a]).collect();
        for (i, &a) in cover.iter().enumerate() {
            groups.extend(cover[i + 1..].iter().map(|&b| vec![a, b]));
        }
        for group in groups {
            evaluated += 1;
            let saved: i64 = group.iter().map(|&c| disks[c].r2).sum();
            let mut holes: Vec<usize> = Vec::new();
            for &c in &group {
                for &m in &disks[c].members {
                    let times = group.iter().filter(|&&g| inside[g][m]).count();
                    if count[m] == times && !holes.contains(&m) {
                        holes.push(m);
                    }
                }
            }
            let option = match holes.first() {
                None => Some((saved, None)),
                Some(&u) => containing[u].iter().filter(|&&c| !group.contains(&c) && holes.iter().all(|&h| inside[c][h]))
                    .min_by_key(|&&c| (disks[c].r2, c)).map(|&c| (saved - disks[c].r2, Some(c))),
            };
            if let Some((gain, add)) = option {
                if gain > 0 && best.as_ref().map_or(true, |b| gain > b.0) {
                    best = Some((gain, group, add));
                }
            }
        }
        let Some((_, group, add)) = best else { break };
        cover.retain(|c| !group.contains(c));
        cover.extend(add);
        cover = prune(n, disks, &cover);
        moves += 1;
        history.push(("replace", cover.clone()));
    }
    (cover, moves, evaluated)
}

fn destroy_and_repair(n: usize, p: &[(i64, i64)], disks: &[Disk], containing: &[Vec<usize>], start: &[usize], seed: u64, iterations: usize, history: &mut Vec<(&'static str, Vec<usize>)>) -> (Vec<usize>, Vec<(usize, i64)>, usize) {
    let mut rng = Rng(seed);
    let mut cur = start.to_vec();
    let mut cur_cost = cost2(disks, &cur);
    let mut trace = Vec::new();
    let mut improved = 0;
    let mut gain = vec![0usize; disks.len()];
    for it in 1..=iterations {
        let pivot = disks[cur[rng.below(cur.len())]].centre;
        let q = 2 + rng.below(5);
        let mut order = cur.clone();
        order.sort_by_key(|&c| (sq(p, pivot, disks[c].centre), c));
        let mut next = order.split_off(q.min(order.len()));
        let mut covered = vec![false; n];
        for &c in &next {
            disks[c].members.iter().for_each(|&m| covered[m] = true);
        }
        let mut holes: Vec<usize> = (0..n).filter(|&m| !covered[m]).collect();
        while !holes.is_empty() {
            let mut touched = Vec::new();
            for &u in &holes {
                for &c in &containing[u] {
                    if gain[c] == 0 {
                        touched.push(c);
                    }
                    gain[c] += 1;
                }
            }
            touched.sort_unstable();
            let mut best = (f64::MIN, usize::MAX);
            for &c in &touched {
                let score = gain[c] as f64 / disks[c].r2 as f64 * (0.7 + 0.6 * rng.unit());
                if score > best.0 {
                    best = (score, c);
                }
                gain[c] = 0;
            }
            next.push(best.1);
            holes.retain(|&u| !disks[best.1].members.contains(&u));
        }
        let next = prune(n, disks, &next);
        let c = cost2(disks, &next);
        if c <= cur_cost {
            if c < cur_cost {
                improved += 1;
                history.push(("search", next.clone()));
            }
            cur = next;
            cur_cost = c;
        }
        if [100, 1000, 5000, iterations].contains(&it) {
            trace.push((it, cur_cost));
        }
    }
    (cur, trace, improved)
}

fn cost2(disks: &[Disk], cover: &[usize]) -> i64 {
    cover.iter().map(|&c| disks[c].r2).sum()
}

fn area(disks: &[Disk], cover: &[usize]) -> f64 {
    std::f64::consts::PI * cost2(disks, cover) as f64
}

fn verify(p: &[(i64, i64)], disks: &[Disk], cover: &[usize]) -> bool {
    (0..p.len()).all(|j| cover.iter().any(|&c| sq(p, disks[c].centre, j) <= disks[c].r2))
}

fn colour(i: usize) -> RGBColor {
    let h = (i as f64 * 0.618_033_988_75).fract();
    let (s, l) = (0.75f64, 0.45f64);
    let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
    let x = c * (1.0 - ((h * 6.0) % 2.0 - 1.0).abs());
    let (r, g, b) = match (h * 6.0) as u32 {
        0 => (c, x, 0.0),
        1 => (x, c, 0.0),
        2 => (0.0, c, x),
        3 => (0.0, x, c),
        4 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };
    let m = l - c / 2.0;
    RGBColor(((r + m) * 255.0) as u8, ((g + m) * 255.0) as u8, ((b + m) * 255.0) as u8)
}

fn plot(path: &str, p: &[(i64, i64)], disks: &[Disk], cover: &[usize]) {
    let (size, pad) = (1000i32, 20i32);
    let root = BitMapBackend::new(path, ((size + 2 * pad) as u32, (size + 2 * pad) as u32)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let s = size as f64 / 1999.0;
    let px = |q: (i64, i64)| (pad + (q.0 as f64 * s) as i32, pad + (q.1 as f64 * s) as i32);
    root.draw(&Rectangle::new([(pad, pad), (pad + size, pad + size)], BLACK.stroke_width(2))).unwrap();
    let mut first = vec![usize::MAX; p.len()];
    for (k, &c) in cover.iter().enumerate() {
        let r = ((disks[c].r2 as f64).sqrt() * s) as i32;
        let col = colour(k);
        root.draw(&Circle::new(px(p[disks[c].centre]), r, col.mix(0.08).filled())).unwrap();
        root.draw(&Circle::new(px(p[disks[c].centre]), r, col.stroke_width(2))).unwrap();
        for &m in &disks[c].members {
            if first[m] == usize::MAX {
                first[m] = k;
            }
        }
    }
    for (j, &q) in p.iter().enumerate() {
        root.draw(&Circle::new(px(q), 3, colour(first[j]).filled())).unwrap();
    }
    for &c in cover {
        root.draw(&Cross::new(px(p[disks[c].centre]), 6, BLACK.stroke_width(2))).unwrap();
    }
    root.present().unwrap();
}

fn cover_json(disks: &[Disk], cover: &[usize]) -> serde_json::Value {
    let mut sorted = cover.to_vec();
    sorted.sort_unstable();
    json!(sorted.iter().map(|&c| json!({
        "centre_id": disks[c].centre + 1, "radius_squared": disks[c].r2,
        "radius": (disks[c].r2 as f64).sqrt(), "set_size": disks[c].members.len(),
        "area": std::f64::consts::PI * disks[c].r2 as f64,
    })).collect::<Vec<_>>())
}

fn main() {
    let seeds = [1u64, 2, 3, 4, 5];
    let iterations = 20000;
    for (n, sizes) in [(100, vec![10, 15, 20, 30, 50]), (500, vec![10, 20, 30, 50, 100])] {
        let dir = format!("src/bin/tsp{n}");
        let p: Vec<(i64, i64)> = load_points(&format!("HW9_TSP_{n}.txt")).iter().map(|&(x, y)| (x as i64, y as i64)).collect();
        let t5: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(format!("{dir}/HW9_T5_{n}_results.json")).unwrap()).unwrap();

        let disks = build_family(&p, &sizes);
        let mut containing = vec![Vec::new(); n];
        let mut inside = vec![vec![false; n]; disks.len()];
        for (c, d) in disks.iter().enumerate() {
            for &m in &d.members {
                containing[m].push(c);
                inside[c][m] = true;
            }
        }

        let t = Instant::now();
        let greedy = weighted_greedy(n, &disks, &containing);
        let greedy_time = t.elapsed().as_secs_f64();
        assert!((area(&disks, &greedy) - t5["t5"]["area"].as_f64().unwrap()).abs() < 1e-6);

        let t = Instant::now();
        let pruned = prune(n, &disks, &greedy);
        let prune_time = t.elapsed().as_secs_f64();

        let t = Instant::now();
        let mut history = vec![("greedy", greedy.clone()), ("prune", pruned.clone())];
        let (replaced, moves, evaluated) = replacements(n, &disks, &containing, &inside, &pruned, &mut history);
        let replace_time = t.elapsed().as_secs_f64();

        let mut runs = Vec::new();
        let mut best: Option<Vec<usize>> = None;
        let mut best_history = Vec::new();
        for &seed in &seeds {
            let t = Instant::now();
            let mut run_history = Vec::new();
            let (searched, trace, improved) = destroy_and_repair(n, &p, &disks, &containing, &replaced, seed, iterations, &mut run_history);
            let (polished, _, _) = replacements(n, &disks, &containing, &inside, &searched, &mut run_history);
            let seconds = t.elapsed().as_secs_f64();
            assert!(verify(&p, &disks, &polished));
            println!("  n={n} seed {seed}: {} disks, area {:.3}, improving iterations {improved}, {seconds:.2}s", polished.len(), area(&disks, &polished));
            runs.push(json!({
                "seed": seed, "iterations": iterations, "improving_iterations": improved, "seconds": seconds,
                "disks": polished.len(), "area": area(&disks, &polished),
                "trace": trace.iter().map(|&(it, c)| json!({"iteration": it, "area": std::f64::consts::PI * c as f64})).collect::<Vec<_>>(),
            }));
            if best.as_ref().map_or(true, |b| cost2(&disks, &polished) < cost2(&disks, b)) {
                best = Some(polished);
                best_history = run_history;
            }
        }
        let best = best.unwrap();
        history.extend(best_history);
        history.push(("final", best.clone()));

        for cover in [&greedy, &pruned, &replaced, &best] {
            assert!(verify(&p, &disks, cover));
        }
        let (a0, a1, a2, a3) = (area(&disks, &greedy), area(&disks, &pruned), area(&disks, &replaced), area(&disks, &best));
        let pct = |a: f64| 100.0 * (a0 - a) / a0;
        println!("n={n}: {} candidates", disks.len());
        println!("  greedy   {} disks {a0:.3} ({greedy_time:.4}s)", greedy.len());
        println!("  pruned   {} disks {a1:.3} -{:.2}% ({prune_time:.4}s)", pruned.len(), pct(a1));
        println!("  replaced {} disks {a2:.3} -{:.2}% ({moves} moves, {evaluated} groups, {replace_time:.4}s)", replaced.len(), pct(a2));
        println!("  searched {} disks {a3:.3} -{:.2}%", best.len(), pct(a3));

        std::fs::write(format!("{dir}/HW9_B1_{n}_results.json"), serde_json::to_string_pretty(&json!({
            "points": n, "target_sizes": sizes, "candidates": disks.len(), "verified": true,
            "greedy": {"disks": greedy.len(), "area": a0, "seconds": greedy_time, "cover": cover_json(&disks, &greedy)},
            "pruned": {"disks": pruned.len(), "area": a1, "improvement_percent": pct(a1), "seconds": prune_time},
            "replaced": {"disks": replaced.len(), "area": a2, "improvement_percent": pct(a2), "moves": moves, "groups_evaluated": evaluated, "seconds": replace_time, "cover": cover_json(&disks, &replaced)},
            "searched": {"disks": best.len(), "area": a3, "improvement_percent": pct(a3), "runs": runs, "cover": cover_json(&disks, &best)},
        })).unwrap()).unwrap();
        std::fs::write(format!("{dir}/HW9_B1_{n}_history.json"), serde_json::to_string(&history.iter().map(|(stage, cover)| json!({
            "stage": stage, "cover": cover.iter().map(|&c| [disks[c].centre + 1, disks[c].r2 as usize]).collect::<Vec<_>>(),
        })).collect::<Vec<_>>()).unwrap()).unwrap();
        plot(&format!("{dir}/HW9_B1_{n}_best.png"), &p, &disks, &best);
    }
}
