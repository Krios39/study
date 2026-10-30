use std::collections::BTreeMap;
use std::time::Instant;

use plotters::prelude::*;
use serde_json::json;

use hw9::*;

struct Disk {
    centre: usize,
    r2: i64,
    targets: Vec<usize>,
    members: Vec<usize>,
}

fn sq(p: &[(i64, i64)], a: usize, b: usize) -> i64 {
    let (dx, dy) = (p[a].0 - p[b].0, p[a].1 - p[b].1);
    dx * dx + dy * dy
}

fn build_family(p: &[(i64, i64)], sizes: &[usize]) -> Vec<Disk> {
    let n = p.len();
    let mut seen: BTreeMap<(usize, i64), Vec<usize>> = BTreeMap::new();
    for i in 0..n {
        let mut others: Vec<(i64, usize)> = (0..n).filter(|&j| j != i).map(|j| (sq(p, i, j), j)).collect();
        others.sort_unstable();
        for &k in sizes {
            seen.entry((i, others[k - 2].0)).or_default().push(k);
        }
    }
    seen.into_iter().map(|((centre, r2), targets)| {
        let members = (0..n).filter(|&j| sq(p, centre, j) <= r2).collect();
        Disk { centre, r2, targets, members }
    }).collect()
}

fn better(ga: usize, ra: i64, gb: usize, rb: i64) -> bool {
    (ga as i128) * (rb as i128) > (gb as i128) * (ra as i128)
}

fn greedy(n: usize, disks: &[Disk], pick: impl Fn(usize, &Disk, usize, &Disk) -> bool) -> Vec<(usize, usize)> {
    let mut containing = vec![Vec::new(); n];
    for (c, d) in disks.iter().enumerate() {
        for &m in &d.members {
            containing[m].push(c);
        }
    }
    let mut gain: Vec<usize> = disks.iter().map(|d| d.members.len()).collect();
    let mut covered = vec![false; n];
    let mut left = n;
    let mut chosen = Vec::new();
    while left > 0 {
        let mut best: Option<usize> = None;
        for c in 0..disks.len() {
            if gain[c] > 0 && best.map_or(true, |b| pick(gain[c], &disks[c], gain[b], &disks[b])) {
                best = Some(c);
            }
        }
        let b = best.unwrap();
        chosen.push((b, gain[b]));
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

fn weighted(n: usize, disks: &[Disk]) -> Vec<(usize, usize)> {
    greedy(n, disks, |ga, a, gb, b| better(ga, a.r2, gb, b.r2))
}

fn largest_new(n: usize, disks: &[Disk]) -> Vec<(usize, usize)> {
    greedy(n, disks, |ga, _, gb, _| ga > gb)
}

fn prune(n: usize, disks: &[Disk], cover: &[usize]) -> Vec<usize> {
    let mut count = vec![0usize; n];
    for &c in cover {
        for &m in &disks[c].members {
            count[m] += 1;
        }
    }
    let mut by_cost = cover.to_vec();
    by_cost.sort_by_key(|&c| std::cmp::Reverse(disks[c].r2));
    let mut kept = cover.to_vec();
    for c in by_cost {
        if disks[c].members.iter().all(|&m| count[m] > 1) {
            disks[c].members.iter().for_each(|&m| count[m] -= 1);
            kept.retain(|&x| x != c);
        }
    }
    kept
}

fn cost(disks: &[Disk], cover: &[usize]) -> f64 {
    cover.iter().map(|&c| std::f64::consts::PI * disks[c].r2 as f64).sum()
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
    json!(cover.iter().map(|&c| json!({
        "centre_id": disks[c].centre + 1, "radius_squared": disks[c].r2,
        "radius": (disks[c].r2 as f64).sqrt(), "set_size": disks[c].members.len(),
        "area": std::f64::consts::PI * disks[c].r2 as f64,
    })).collect::<Vec<_>>())
}

fn main() {
    for (n, base, sizes) in [(100, 10, vec![10, 15, 20, 30, 50]), (500, 50, vec![10, 20, 30, 50, 100])] {
        let dir = format!("src/bin/tsp{n}");
        let p: Vec<(i64, i64)> = load_points(&format!("HW9_TSP_{n}.txt")).iter().map(|&(x, y)| (x as i64, y as i64)).collect();
        let t4: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(format!("{dir}/HW9_T4_{n}_results.json")).unwrap()).unwrap();
        let old_cost = t4["total_area"].as_f64().unwrap();

        let t = Instant::now();
        let family = build_family(&p, &sizes);
        let prep = t.elapsed().as_secs_f64();
        let t = Instant::now();
        let steps = weighted(n, &family);
        let greedy_time = t.elapsed().as_secs_f64();
        let cover: Vec<usize> = steps.iter().map(|s| s.0).collect();
        assert!(verify(&p, &family, &cover));
        let new_cost = cost(&family, &cover);
        let improvement = 100.0 * (old_cost - new_cost) / old_cost;

        let mut per_size = BTreeMap::new();
        for &k in &sizes {
            let single = build_family(&p, &[k]);
            let c: Vec<usize> = weighted(n, &single).iter().map(|s| s.0).collect();
            assert!(verify(&p, &single, &c));
            per_size.insert(k.to_string(), json!({"disks": c.len(), "area": cost(&single, &c)}));
        }
        let base_family = build_family(&p, &[base]);
        let base_cover: Vec<usize> = weighted(n, &base_family).iter().map(|s| s.0).collect();
        assert!((cost(&base_family, &base_cover) - old_cost).abs() < 1e-6);

        let grid = [10, 12, 15, 20, 25, 30, 40, 50, 75, 100];
        let single_cost: BTreeMap<usize, f64> = grid.iter().map(|&k| {
            let f = build_family(&p, &[k]);
            let c: Vec<usize> = weighted(n, &f).iter().map(|s| s.0).collect();
            (k, cost(&f, &c))
        }).collect();
        let mut pairs = Vec::new();
        for (i, &a) in grid.iter().enumerate() {
            for &b in &grid[i + 1..] {
                let f = build_family(&p, &[a, b]);
                let c: Vec<usize> = weighted(n, &f).iter().map(|s| s.0).collect();
                assert!(verify(&p, &f, &c));
                let (area, best_single) = (cost(&f, &c), single_cost[&a].min(single_cost[&b]));
                pairs.push(json!({"sizes": [a, b], "area": area, "best_single_area": best_single, "worse_percent": 100.0 * (area / best_single - 1.0)}));
            }
        }
        let misled: Vec<&serde_json::Value> = pairs.iter().filter(|x| x["worse_percent"].as_f64().unwrap() > 1e-9).collect();
        let worst = pairs.iter().max_by(|a, b| a["worse_percent"].as_f64().unwrap().total_cmp(&b["worse_percent"].as_f64().unwrap())).unwrap();
        println!("  pairs: {} of {} worse than their best single size, worst {worst}", misled.len(), pairs.len());
        std::fs::write(format!("{dir}/HW9_T5_{n}_size_pairs.json"), serde_json::to_string_pretty(&json!({"single": single_cost.iter().map(|(k, v)| (k.to_string(), *v)).collect::<BTreeMap<_, _>>(), "pairs": pairs})).unwrap()).unwrap();

        if n == 100 {
            let f = build_family(&p, &[10, 100]);
            let g: Vec<usize> = weighted(n, &f).iter().map(|s| s.0).collect();
            let one = (0..f.len()).filter(|&c| f[c].members.len() == n).min_by_key(|&c| (f[c].r2, f[c].centre)).unwrap();
            assert!(verify(&p, &f, &g) && verify(&p, &f, &[one]) && cost(&f, &[one]) < cost(&f, &g));
            println!("  counterexample {{10,100}}: greedy {} disks {:.3}, one disk centre {} r {:.3} area {:.3}", g.len(), cost(&f, &g), f[one].centre + 1, (f[one].r2 as f64).sqrt(), cost(&f, &[one]));
            std::fs::write(format!("{dir}/HW9_T5_100_counterexample.json"), serde_json::to_string_pretty(&json!({
                "points": p.iter().enumerate().map(|(i, q)| json!([i + 1, q.0, q.1])).collect::<Vec<_>>(),
                "candidates": f.iter().map(|d| json!({"centre_id": d.centre + 1, "radius_squared": d.r2, "set_size": d.members.len()})).collect::<Vec<_>>(),
                "greedy_cover": cover_json(&f, &g), "greedy_area": cost(&f, &g),
                "better_cover": cover_json(&f, &[one]), "better_area": cost(&f, &[one]),
            })).unwrap()).unwrap();
            plot(&format!("{dir}/HW9_T5_100_counterexample_one_disk.png"), &p, &f, &[one]);
        }

        let mut used: BTreeMap<usize, usize> = BTreeMap::new();
        for &c in &cover {
            *used.entry(family[c].members.len()).or_insert(0) += 1;
        }

        let pruned = prune(n, &family, &cover);
        let large: Vec<usize> = largest_new(n, &family).iter().map(|s| s.0).collect();
        let large_pruned = prune(n, &family, &large);
        let alternatives = [("weighted greedy, redundant disks removed", &pruned), ("largest new set first", &large), ("largest new set first, redundant disks removed", &large_pruned)];
        for (_, c) in &alternatives {
            assert!(verify(&p, &family, c));
        }
        let (alt_name, alt) = alternatives.iter().min_by(|a, b| cost(&family, a.1).total_cmp(&cost(&family, b.1))).unwrap();
        let alt_cost = cost(&family, alt);

        println!("n={n}: {} candidates, sizes {sizes:?}, build {prep:.4}s, greedy {greedy_time:.4}s", family.len());
        println!("  T4 {old_cost:.3} -> T5 {new_cost:.3} ({} disks) improvement {improvement:.2}%, selected sizes {used:?}", cover.len());
        println!("  per size: {per_size:?}");
        for (name, c) in &alternatives {
            println!("  alt [{name}]: {} disks, {:.3}", c.len(), cost(&family, c));
        }
        println!("  best alternative: {alt_name}, {:.3}, lower than greedy: {}", alt_cost, alt_cost < new_cost);

        std::fs::write(format!("{dir}/HW9_T5_{n}_candidates.csv"),
                       "centre_id,radius_squared,radius,area,set_size,target_sizes\n".to_string() + &family.iter().map(|d| format!("{},{},{:.6},{:.6},{},{}\n", d.centre + 1, d.r2, (d.r2 as f64).sqrt(), std::f64::consts::PI * d.r2 as f64, d.members.len(), d.targets.iter().map(|k| k.to_string()).collect::<Vec<_>>().join(" "))).collect::<String>()).unwrap();
        std::fs::write(format!("{dir}/HW9_T5_{n}_selected.csv"),
                       "step,centre_id,radius_squared,radius,area,set_size,newly_covered\n".to_string() + &steps.iter().enumerate().map(|(s, &(c, g))| format!("{},{},{},{:.6},{:.6},{},{}\n", s + 1, family[c].centre + 1, family[c].r2, (family[c].r2 as f64).sqrt(), std::f64::consts::PI * family[c].r2 as f64, family[c].members.len(), g)).collect::<String>()).unwrap();
        std::fs::write(format!("{dir}/HW9_T5_{n}_results.json"), serde_json::to_string_pretty(&json!({
            "points": n, "t4_k": base, "target_sizes": sizes, "candidates": family.len(),
            "candidate_seconds": prep, "greedy_seconds": greedy_time, "verified": true,
            "t4": {"disks": t4["selected"], "area": old_cost},
            "t5": {"disks": cover.len(), "area": new_cost, "improvement_percent": improvement, "selected_set_sizes": used, "cover": cover_json(&family, &cover)},
            "single_size_families": per_size,
            "alternatives": alternatives.iter().map(|(name, c)| json!({"method": name, "disks": c.len(), "area": cost(&family, c)})).collect::<Vec<_>>(),
            "counterexample": {"method": alt_name, "disks": alt.len(), "area": alt_cost, "lower_than_greedy": alt_cost < new_cost, "cover": cover_json(&family, alt)},
        })).unwrap()).unwrap();
        plot(&format!("{dir}/HW9_T5_{n}_cover.png"), &p, &family, &cover);
        plot(&format!("{dir}/HW9_T5_{n}_alternative.png"), &p, &family, alt);
    }
}
