use std::time::Instant;

use plotters::prelude::*;
use serde_json::json;

use hw9::*;

struct Disk {
    centre: usize,
    r2: i64,
    members: Vec<usize>,
}

fn sq(p: &[(i64, i64)], a: usize, b: usize) -> i64 {
    let (dx, dy) = (p[a].0 - p[b].0, p[a].1 - p[b].1);
    dx * dx + dy * dy
}

fn knn_disks(p: &[(i64, i64)], k: usize) -> (Vec<Vec<usize>>, Vec<Disk>) {
    let n = p.len();
    let mut links = Vec::with_capacity(n);
    let mut disks = Vec::with_capacity(n);
    for i in 0..n {
        let mut others: Vec<usize> = (0..n).filter(|&j| j != i).collect();
        others.sort_by_key(|&j| (sq(p, i, j), j));
        let near = others[..k - 1].to_vec();
        let r2 = sq(p, i, near[k - 2]);
        let members = (0..n).filter(|&j| sq(p, i, j) <= r2).collect();
        links.push(near);
        disks.push(Disk { centre: i, r2, members });
    }
    (links, disks)
}

fn better(ga: usize, ra: i64, gb: usize, rb: i64) -> bool {
    (ga as i128) * (rb as i128) > (gb as i128) * (ra as i128)
}

fn weighted_greedy(n: usize, disks: &[Disk]) -> (Vec<(usize, usize)>, Vec<usize>) {
    let mut containing = vec![Vec::new(); n];
    for (c, d) in disks.iter().enumerate() {
        for &m in &d.members {
            containing[m].push(c);
        }
    }
    let mut gain: Vec<usize> = disks.iter().map(|d| d.members.len()).collect();
    let mut first = vec![usize::MAX; n];
    let mut left = n;
    let mut chosen = Vec::new();
    while left > 0 {
        let mut best: Option<usize> = None;
        for c in 0..disks.len() {
            if gain[c] == 0 {
                continue;
            }
            if best.map_or(true, |b| better(gain[c], disks[c].r2, gain[b], disks[b].r2)) {
                best = Some(c);
            }
        }
        let b = best.unwrap();
        chosen.push((b, gain[b]));
        for &m in &disks[b].members {
            if first[m] == usize::MAX {
                first[m] = chosen.len() - 1;
                left -= 1;
                for &c in &containing[m] {
                    gain[c] -= 1;
                }
            }
        }
    }
    (chosen, first)
}

fn verify(p: &[(i64, i64)], disks: &[Disk], chosen: &[(usize, usize)]) -> bool {
    (0..p.len()).all(|j| chosen.iter().any(|&(c, _)| sq(p, disks[c].centre, j) <= disks[c].r2))
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

fn plot(path: &str, p: &[(i64, i64)], disks: &[Disk], chosen: &[(usize, usize)], first: &[usize]) {
    let (size, pad) = (1000i32, 20i32);
    let root = BitMapBackend::new(path, ((size + 2 * pad) as u32, (size + 2 * pad) as u32)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let s = size as f64 / 1999.0;
    let px = |q: (i64, i64)| (pad + (q.0 as f64 * s) as i32, pad + (q.1 as f64 * s) as i32);
    root.draw(&Rectangle::new([(pad, pad), (pad + size, pad + size)], BLACK.stroke_width(2))).unwrap();
    for (k, &(c, _)) in chosen.iter().enumerate() {
        let r = ((disks[c].r2 as f64).sqrt() * s) as i32;
        let col = colour(k);
        root.draw(&Circle::new(px(p[disks[c].centre]), r, col.mix(0.08).filled())).unwrap();
        root.draw(&Circle::new(px(p[disks[c].centre]), r, col.stroke_width(2))).unwrap();
    }
    for (j, &q) in p.iter().enumerate() {
        root.draw(&Circle::new(px(q), 3, colour(first[j]).filled())).unwrap();
    }
    for &(c, _) in chosen {
        let (x, y) = px(p[disks[c].centre]);
        root.draw(&Cross::new((x, y), 6, BLACK.stroke_width(2))).unwrap();
    }
    root.present().unwrap();
}

fn main() {
    for (n, k) in [(100, 10), (500, 50), (2000, 100)] {
        let dir = format!("src/bin/tsp{n}");
        let p: Vec<(i64, i64)> = load_points(&format!("HW9_TSP_{n}.txt")).iter().map(|&(x, y)| (x as i64, y as i64)).collect();

        let t = Instant::now();
        let (links, disks) = knn_disks(&p, k);
        let prep = t.elapsed().as_secs_f64();
        let t = Instant::now();
        let (chosen, first) = weighted_greedy(n, &disks);
        let greedy = t.elapsed().as_secs_f64();
        assert!(verify(&p, &disks, &chosen));

        let area = |c: usize| std::f64::consts::PI * disks[c].r2 as f64;
        let total: f64 = chosen.iter().map(|&(c, _)| area(c)).sum();
        let sizes: Vec<usize> = disks.iter().map(|d| d.members.len()).collect();
        println!("n={n:4} K={k:3}: {} disks, area {total:.3}, candidates built {prep:.4}s, greedy {greedy:.4}s, candidate sizes {}..{}",
                 chosen.len(), sizes.iter().min().unwrap(), sizes.iter().max().unwrap());
        for (step, &(c, g)) in chosen.iter().take(3).enumerate() {
            println!("   step {}: centre {} r={:.3} size {} new {g} area {:.3} ratio {:.6e}", step + 1, c + 1,
                     (disks[c].r2 as f64).sqrt(), disks[c].members.len(), area(c), g as f64 / area(c));
        }

        std::fs::write(format!("{dir}/HW9_T4_{n}_knn_links.txt"),
                       links.iter().enumerate().map(|(i, l)| format!("{} -> {}\n", i + 1, l.iter().map(|j| (j + 1).to_string()).collect::<Vec<_>>().join(" "))).collect::<String>()).unwrap();
        std::fs::write(format!("{dir}/HW9_T4_{n}_candidates.csv"),
                       "centre_id,radius_squared,radius,area,size\n".to_string() + &disks.iter().map(|d| format!("{},{},{:.6},{:.6},{}\n", d.centre + 1, d.r2, (d.r2 as f64).sqrt(), area(d.centre), d.members.len())).collect::<String>()).unwrap();
        std::fs::write(format!("{dir}/HW9_T4_{n}_selected.csv"),
                       "step,centre_id,radius_squared,radius,area,size,newly_covered,ratio\n".to_string() + &chosen.iter().enumerate().map(|(s, &(c, g))| format!("{},{},{},{:.6},{:.6},{},{},{:.9e}\n", s + 1, c + 1, disks[c].r2, (disks[c].r2 as f64).sqrt(), area(c), disks[c].members.len(), g, g as f64 / area(c))).collect::<String>()).unwrap();
        std::fs::write(format!("{dir}/HW9_T4_{n}_first_cover.csv"),
                       "point_id,first_step,centre_id\n".to_string() + &first.iter().enumerate().map(|(j, &s)| format!("{},{},{}\n", j + 1, s + 1, chosen[s].0 + 1)).collect::<String>()).unwrap();
        std::fs::write(format!("{dir}/HW9_T4_{n}_results.json"), serde_json::to_string_pretty(&json!({
            "points": n, "k": k, "candidates": disks.len(),
            "candidate_size_min": sizes.iter().min(), "candidate_size_max": sizes.iter().max(),
            "selected": chosen.len(), "total_area": total, "covered": first.len(), "verified": true,
            "candidate_seconds": prep, "greedy_seconds": greedy,
            "first_steps": chosen.iter().take(3).enumerate().map(|(s, &(c, g))| json!({"step": s + 1, "centre_id": c + 1, "radius": (disks[c].r2 as f64).sqrt(), "size": disks[c].members.len(), "newly_covered": g, "area": area(c), "ratio": g as f64 / area(c)})).collect::<Vec<_>>(),
            "selected_centres": chosen.iter().map(|&(c, _)| c + 1).collect::<Vec<_>>(),
        })).unwrap()).unwrap();
        plot(&format!("{dir}/HW9_T4_{n}_cover.png"), &p, &disks, &chosen, &first);
    }
}
