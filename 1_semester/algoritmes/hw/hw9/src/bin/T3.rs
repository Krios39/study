use std::collections::HashSet;
use std::time::Instant;

use serde_json::json;

use hw9::*;

fn load_edges(path: &str) -> Vec<(usize, usize)> {
    std::fs::read_to_string(path).unwrap().lines().filter(|l| !l.trim().is_empty()).map(|l| {
        let v: Vec<usize> = l.split_whitespace().map(|x| x.parse().unwrap()).collect();
        (v[0] - 1, v[1] - 1)
    }).collect()
}

fn dfs_preorder(adj: &[Vec<usize>], root: usize, increasing: bool) -> Vec<usize> {
    let n = adj.len();
    let mut seen = vec![false; n];
    let mut order = Vec::with_capacity(n);
    let mut stack = vec![root];
    while let Some(u) = stack.pop() {
        if seen[u] {
            continue;
        }
        seen[u] = true;
        order.push(u);
        let push = |v: &usize| if !seen[*v] { Some(*v) } else { None };
        if increasing {
            stack.extend(adj[u].iter().rev().filter_map(push));
        } else {
            stack.extend(adj[u].iter().filter_map(push));
        }
    }
    order
}

fn nearest_neighbour(neigh: &[Vec<usize>], start: usize) -> Vec<usize> {
    let n = neigh.len();
    let mut seen = vec![false; n];
    let mut tour = Vec::with_capacity(n);
    tour.push(start);
    seen[start] = true;
    let mut u = start;
    while tour.len() < n {
        let v = *neigh[u].iter().find(|&&v| !seen[v]).unwrap();
        seen[v] = true;
        tour.push(v);
        u = v;
    }
    tour
}

fn canonical(tour: &[usize]) -> Vec<usize> {
    let n = tour.len();
    let p = tour.iter().position(|&x| x == 0).unwrap();
    let fwd: Vec<usize> = (0..n).map(|i| tour[(p + i) % n]).collect();
    let bwd: Vec<usize> = (0..n).map(|i| tour[(p + n - i) % n]).collect();
    fwd.min(bwd)
}

fn median(v: &[f64]) -> f64 {
    let mut s = v.to_vec();
    s.sort_by(|a, b| a.total_cmp(b));
    let m = s.len() / 2;
    if s.len() % 2 == 1 { s[m] } else { (s[m - 1] + s[m]) / 2.0 }
}

struct Run {
    start: usize,
    increasing: Option<bool>,
    length: f64,
    tour: Vec<usize>,
}

fn summary(runs: &[Run], seconds: f64) -> serde_json::Value {
    let lens: Vec<f64> = runs.iter().map(|r| r.length).collect();
    let best = runs.iter().min_by(|a, b| a.length.total_cmp(&b.length).then(a.start.cmp(&b.start))).unwrap();
    let worst = runs.iter().max_by(|a, b| a.length.total_cmp(&b.length).then(b.start.cmp(&a.start))).unwrap();
    let distinct: HashSet<Vec<usize>> = runs.iter().map(|r| canonical(&r.tour)).collect();
    let desc = |r: &Run| json!({"start_id": r.start + 1, "child_order": r.increasing.map(|i| if i { "increasing" } else { "decreasing" }), "length": r.length});
    json!({
        "tours": runs.len(), "distinct_cycles": distinct.len(),
        "best": desc(best), "worst": desc(worst),
        "median": median(&lens), "spread_percent": 100.0 * (worst.length / best.length - 1.0),
        "all_start_seconds": seconds,
    })
}

fn extreme<'a>(runs: &'a [Run], best: bool) -> &'a Run {
    let it = runs.iter();
    if best {
        it.min_by(|a, b| a.length.total_cmp(&b.length).then(a.start.cmp(&b.start))).unwrap()
    } else {
        it.max_by(|a, b| a.length.total_cmp(&b.length).then(b.start.cmp(&a.start))).unwrap()
    }
}

fn main() {
    for n in [100, 500, 2000] {
        let dir = format!("src/bin/tsp{n}");
        let t = Instant::now();
        let points = load_points(&format!("HW9_TSP_{n}.txt"));
        let d = point_distances(&points);
        let edges = load_edges(&format!("{dir}/HW9_T2_{n}_mst_edges.txt"));
        assert_eq!(edges.len(), n - 1);
        let mut adj = vec![Vec::new(); n];
        for &(a, b) in &edges {
            adj[a].push(b);
            adj[b].push(a);
        }
        adj.iter_mut().for_each(|l| l.sort_unstable());
        let neigh: Vec<Vec<usize>> = (0..n).map(|u| {
            let mut l: Vec<usize> = (0..n).filter(|&v| v != u).collect();
            l.sort_by(|&a, &b| d[u][a].total_cmp(&d[u][b]).then(a.cmp(&b)));
            l
        }).collect();
        let prep = t.elapsed().as_secs_f64();

        let t = Instant::now();
        let mst_runs: Vec<Run> = (0..n).flat_map(|s| [true, false].map(|inc| (s, inc))).map(|(s, inc)| {
            let tour = dfs_preorder(&adj, s, inc);
            Run { start: s, increasing: Some(inc), length: tour_length(&d, &tour), tour }
        }).collect();
        let mst_time = t.elapsed().as_secs_f64();

        let t = Instant::now();
        let nn_runs: Vec<Run> = (0..n).map(|s| {
            let tour = nearest_neighbour(&neigh, s);
            Run { start: s, increasing: None, length: tour_length(&d, &tour), tour }
        }).collect();
        let nn_time = t.elapsed().as_secs_f64();

        let t2: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(format!("{dir}/HW9_T2_{n}_results.json")).unwrap()).unwrap();
        assert!((nn_runs[0].length - t2["nn_tour"]["length"].as_f64().unwrap()).abs() < 1e-9);
        assert!((mst_runs[0].length - t2["mst_tour"]["length"].as_f64().unwrap()).abs() < 1e-9);

        let ms = summary(&mst_runs, mst_time);
        let ns = summary(&nn_runs, nn_time);
        println!("n={n:4} prep {prep:.3}s");
        for (name, s) in [("MST", &ms), ("NN ", &ns)] {
            println!("  {name}: best {:.3} (id {} {}) worst {:.3} (id {} {}) median {:.3} spread {:.2}% distinct {}/{} time {:.4}s",
                     s["best"]["length"].as_f64().unwrap(), s["best"]["start_id"], s["best"]["child_order"],
                     s["worst"]["length"].as_f64().unwrap(), s["worst"]["start_id"], s["worst"]["child_order"],
                     s["median"].as_f64().unwrap(), s["spread_percent"].as_f64().unwrap(),
                     s["distinct_cycles"], s["tours"], s["all_start_seconds"].as_f64().unwrap());
        }

        for (name, runs) in [("mst", &mst_runs), ("nn", &nn_runs)] {
            save_ids(&extreme(runs, true).tour, &format!("{dir}/HW9_T3_{n}_{name}_best.txt"));
            save_ids(&extreme(runs, false).tour, &format!("{dir}/HW9_T3_{n}_{name}_worst.txt"));
            let csv: String = runs.iter().map(|r| match r.increasing {
                Some(i) => format!("{},{},{:.6}\n", r.start + 1, if i { "increasing" } else { "decreasing" }, r.length),
                None => format!("{},{:.6}\n", r.start + 1, r.length),
            }).collect();
            let header = if name == "mst" { "start_id,child_order,length\n" } else { "start_id,length\n" };
            std::fs::write(format!("{dir}/HW9_T3_{n}_{name}_scores.csv"), format!("{header}{csv}")).unwrap();
        }
        std::fs::write(format!("{dir}/HW9_T3_{n}_results.json"), serde_json::to_string_pretty(&json!({
            "points": n, "preparation_seconds": prep,
            "preparation": "distance matrix, T2 MST read from file, sorted tree adjacency, sorted neighbour lists",
            "mst_tours": ms, "nn_tours": ns,
        })).unwrap()).unwrap();
    }
}
