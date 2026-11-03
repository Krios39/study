use std::time::Instant;

use serde_json::json;

use hw9::*;

const THREADS: usize = 12;
const EPS: f64 = 1e-7;
const MAX_EXHAUSTIVE: usize = 18;

fn links(tour: &[usize]) -> Vec<[usize; 2]> {
    let n = tour.len();
    let mut adj = vec![[0; 2]; n];
    for i in 0..n {
        adj[tour[i]] = [tour[(i + n - 1) % n], tour[(i + 1) % n]];
    }
    adj
}

fn has(adj: &[[usize; 2]], a: usize, b: usize) -> bool {
    adj[a][0] == b || adj[a][1] == b
}

fn find(p: &mut [usize], mut x: usize) -> usize {
    while p[x] != x {
        p[x] = p[p[x]];
        x = p[x];
    }
    x
}

fn components(a: &[[usize; 2]], b: &[[usize; 2]], d: &[Vec<f64>]) -> (Vec<usize>, Vec<(usize, f64)>) {
    let n = a.len();
    let mut p: Vec<usize> = (0..n).collect();
    for v in 0..n {
        for u in a[v].into_iter().chain(b[v]) {
            if has(a, v, u) != has(b, v, u) {
                let (x, y) = (find(&mut p, v), find(&mut p, u));
                p[x] = y;
            }
        }
    }
    let label: Vec<usize> = (0..n).map(|v| find(&mut p, v)).collect();
    let mut gain = vec![0.0; n];
    let mut changed = vec![false; n];
    for v in 0..n {
        for u in a[v] {
            if v < u && !has(b, v, u) {
                gain[label[v]] += d[v][u];
                changed[label[v]] = true;
            }
        }
        for u in b[v] {
            if v < u && !has(a, v, u) {
                gain[label[v]] -= d[v][u];
            }
        }
    }
    let list = (0..n).filter(|&c| changed[c]).map(|c| (c, gain[c])).collect();
    (label, list)
}

fn walk(a: &[[usize; 2]], b: &[[usize; 2]], label: &[usize], chosen: &[usize]) -> Option<Vec<usize>> {
    let n = a.len();
    let at = |v: usize| if chosen.contains(&label[v]) { b[v] } else { a[v] };
    let mut tour = Vec::with_capacity(n);
    let (mut previous, mut u) = (usize::MAX, 0);
    loop {
        tour.push(u);
        if tour.len() > n {
            return None;
        }
        let [x, y] = at(u);
        let next = if x != previous { x } else { y };
        previous = u;
        u = next;
        if u == 0 {
            break;
        }
    }
    (tour.len() == n).then_some(tour)
}

fn cross(base: &[usize], other: &[usize], d: &[Vec<f64>]) -> Option<Vec<usize>> {
    let (a, b) = (links(base), links(other));
    let (label, list) = components(&a, &b, d);
    let mut best: Option<(Vec<usize>, f64)> = None;
    let mut consider = |chosen: &[usize], gain: f64| {
        if gain > EPS && best.as_ref().map_or(true, |x| gain > x.1 + EPS) {
            if let Some(tour) = walk(&a, &b, &label, chosen) {
                best = Some((tour, gain));
            }
        }
    };
    if list.len() <= MAX_EXHAUSTIVE {
        for mask in 1u32..1 << list.len() {
            let chosen: Vec<usize> = (0..list.len()).filter(|i| mask >> i & 1 == 1).map(|i| list[i].0).collect();
            let gain: f64 = (0..list.len()).filter(|i| mask >> i & 1 == 1).map(|i| list[i].1).sum();
            consider(&chosen, gain);
        }
        drop(consider);
        return best.map(|x| x.0);
    }
    for i in 0..list.len() {
        consider(&[list[i].0], list[i].1);
        for j in i + 1..list.len() {
            consider(&[list[i].0, list[j].0], list[i].1 + list[j].1);
        }
    }
    best.map(|x| x.0)
}

fn cycles(adj: &[[usize; 2]]) -> Vec<Vec<usize>> {
    let n = adj.len();
    let mut seen = vec![false; n];
    let mut all = Vec::new();
    for s in 0..n {
        if seen[s] {
            continue;
        }
        let mut cycle = Vec::new();
        let (mut previous, mut u) = (usize::MAX, s);
        loop {
            seen[u] = true;
            cycle.push(u);
            let [x, y] = adj[u];
            let next = if x != previous { x } else { y };
            previous = u;
            u = next;
            if u == s {
                break;
            }
        }
        all.push(cycle);
    }
    all
}

fn swap_link(adj: &mut [[usize; 2]], v: usize, old: usize, new: usize) {
    let i = if adj[v][0] == old { 0 } else { 1 };
    adj[v][i] = new;
}

fn sew(adj: &mut [[usize; 2]], d: &[Vec<f64>]) -> Vec<usize> {
    let n = adj.len();
    loop {
        let mut all = cycles(adj);
        if all.len() == 1 {
            return all.pop().unwrap();
        }
        let small = all.into_iter().min_by_key(|c| c.len()).unwrap();
        let mut inside = vec![false; n];
        small.iter().for_each(|&v| inside[v] = true);
        let mut best = (f64::INFINITY, 0, 0, 0, 0);
        for i in 0..small.len() {
            let (u, v) = (small[i], small[(i + 1) % small.len()]);
            for w in (0..n).filter(|&w| !inside[w]) {
                for x in adj[w] {
                    let delta = d[u][w] + d[v][x] - d[u][v] - d[w][x];
                    if delta < best.0 {
                        best = (delta, u, v, w, x);
                    }
                }
            }
        }
        let (_, u, v, w, x) = best;
        swap_link(adj, u, v, w);
        swap_link(adj, v, u, x);
        swap_link(adj, w, x, u);
        swap_link(adj, x, w, v);
    }
}

fn cross_sewn(base: &[usize], other: &[usize], d: &[Vec<f64>]) -> Option<Vec<usize>> {
    let (a, b) = (links(base), links(other));
    let (label, list) = components(&a, &b, d);
    let base_length = tour_length(d, base);
    let mut best: Option<(Vec<usize>, f64)> = None;
    let mut consider = |chosen: &[usize]| {
        let mut adj: Vec<[usize; 2]> = (0..a.len()).map(|v| if chosen.contains(&label[v]) { b[v] } else { a[v] }).collect();
        let tour = sew(&mut adj, d);
        let length = tour_length(d, &tour);
        if length < base_length - EPS && best.as_ref().map_or(true, |x| length < x.1 - EPS) {
            best = Some((tour, length));
        }
    };
    for i in 0..list.len() {
        if list[i].1 > EPS {
            consider(&[list[i].0]);
        }
        for j in i + 1..list.len() {
            if list[i].1 + list[j].1 > EPS {
                consider(&[list[i].0, list[j].0]);
            }
        }
    }
    best.map(|x| x.0)
}

fn merge(start: &[usize], pool: &[Vec<usize>], d: &[Vec<f64>]) -> Vec<usize> {
    let mut tour = start.to_vec();
    loop {
        let mut improved = false;
        for other in pool {
            if let Some(next) = cross(&tour, other, d).or_else(|| cross_sewn(&tour, other, d)) {
                tour = next;
                improved = true;
            }
        }
        if !improved {
            return tour;
        }
    }
}

fn main() {
    let dir = "src/bin/tsp2000";
    let d = point_distances(&load_points("HW9_TSP_2000.txt"));
    let read = |path: String| -> Vec<usize> { std::fs::read_to_string(path).unwrap().split_whitespace().map(|x| x.parse::<usize>().unwrap() - 1).collect() };
    let base_name = std::env::args().nth(1).unwrap();
    let base = read(format!("{dir}/{base_name}"));
    let mut names: Vec<String> = std::fs::read_dir(format!("{dir}/pool")).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
    names.sort();
    let mut pool: Vec<Vec<usize>> = names.iter().map(|f| read(format!("{dir}/pool/{f}"))).collect();
    pool.insert(0, base.clone());
    names.insert(0, base_name.clone());
    let base_length = tour_length(&d, &base);

    let t = Instant::now();
    let mut stats = Vec::new();
    for (name, other) in names.iter().zip(&pool).skip(1) {
        let (a, b) = (links(&base), links(other));
        let (_, list) = components(&a, &b, &d);
        let shared = (0..a.len()).map(|v| a[v].iter().filter(|&&u| has(&b, v, u)).count()).sum::<usize>() / 2;
        let cheaper = list.iter().filter(|c| c.1 > EPS).count();
        let best_gain = list.iter().map(|c| c.1).fold(f64::MIN, f64::max);
        let all: Vec<usize> = list.iter().map(|c| c.0).collect();
        let (label, _) = components(&a, &b, &d);
        let whole = walk(&a, &b, &label, &all).expect("all parts must give the other tour");
        assert!((tour_length(&d, &whole) - tour_length(&d, other)).abs() < 1e-6);
        println!("{name}: {:.6}, shared edges {shared}, parts {}, cheaper parts {cheaper}, best part gain {best_gain:.6}", tour_length(&d, other), list.len());
        stats.push(json!({"tour": name, "length": tour_length(&d, other), "shared_edges": shared, "parts": list.len(), "cheaper_parts": cheaper, "best_part_gain": best_gain}));
    }

    let results: Vec<(usize, Vec<usize>, f64)> = std::thread::scope(|s| {
        let handles: Vec<_> = (0..THREADS).map(|k| {
            let (d, pool) = (&d, &pool);
            s.spawn(move || (0..pool.len()).filter(|i| i % THREADS == k).map(|i| {
                let tour = merge(&pool[i], pool, d);
                let length = tour_length(d, &tour);
                (i, tour, length)
            }).collect::<Vec<_>>())
        }).collect();
        handles.into_iter().flat_map(|h| h.join().unwrap()).collect()
    });
    let seconds = t.elapsed().as_secs_f64();
    let best = results.iter().min_by(|a, b| a.2.total_cmp(&b.2)).unwrap();
    let mut check = best.1.clone();
    check.sort_unstable();
    assert!(check.iter().enumerate().all(|(i, &c)| i == c));
    println!("base {base_length:.6}; best merged {:.6} from {}, improvement {:.6}, {seconds:.1}s", best.2, names[best.0], base_length - best.2);
    save_ids(&best.1, &format!("{dir}/HW9_B2_merge.txt"));
    std::fs::write(format!("{dir}/HW9_B2_merge_results.json"), serde_json::to_string_pretty(&json!({
        "method": "partition crossover: edges shared by two tours are kept, each part where they differ takes the cheaper version if the result is still one cycle, repeated over a pool",
        "base": base_name, "base_length": base_length, "pool": names.len(), "length": best.2, "started_from": names[best.0], "seconds": seconds,
        "pairs_with_base": stats, "merged": results.iter().map(|r| json!({"start": names[r.0], "length": r.2})).collect::<Vec<_>>(),
    })).unwrap()).unwrap();
}
