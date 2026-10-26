use std::time::Instant;

use petgraph::algo::min_spanning_tree;
use petgraph::data::Element;
use petgraph::graph::UnGraph;
use serde_json::json;

use hw9::*;

fn library_mst(d: &[Vec<f64>]) -> Vec<(usize, usize)> {
    let n = d.len();
    let mut g = UnGraph::<(), f64>::with_capacity(n, n * (n - 1) / 2);
    let nodes: Vec<_> = (0..n).map(|_| g.add_node(())).collect();
    for i in 0..n {
        for j in i + 1..n {
            g.add_edge(nodes[i], nodes[j], d[i][j]);
        }
    }
    min_spanning_tree(&g).filter_map(|e| match e {
        Element::Edge { source, target, .. } => Some((source.min(target), source.max(target))),
        _ => None,
    }).collect()
}

fn dfs_preorder(n: usize, edges: &[(usize, usize)], root: usize) -> Vec<usize> {
    let mut adj = vec![Vec::new(); n];
    for &(a, b) in edges {
        adj[a].push(b);
        adj[b].push(a);
    }
    adj.iter_mut().for_each(|l| l.sort_unstable());
    let mut seen = vec![false; n];
    let mut order = Vec::with_capacity(n);
    let mut stack = vec![root];
    while let Some(u) = stack.pop() {
        if seen[u] {
            continue;
        }
        seen[u] = true;
        order.push(u);
        for &v in adj[u].iter().rev() {
            if !seen[v] {
                stack.push(v);
            }
        }
    }
    order
}

fn nearest_neighbour(d: &[Vec<f64>], start: usize) -> Vec<usize> {
    let n = d.len();
    let mut seen = vec![false; n];
    let mut tour = vec![start];
    seen[start] = true;
    let mut u = start;
    while tour.len() < n {
        let v = (0..n).filter(|&j| !seen[j]).min_by(|&a, &b| d[u][a].total_cmp(&d[u][b]).then(a.cmp(&b))).unwrap();
        seen[v] = true;
        tour.push(v);
        u = v;
    }
    tour
}

fn main() {
    for n in [100, 500, 2000] {
        let dir = format!("src/bin/tsp{n}");
        std::fs::create_dir_all(&dir).unwrap();
        let points = load_points(&format!("HW9_TSP_{n}.txt"));
        let t = Instant::now();
        let d = point_distances(&points);
        let prep = t.elapsed().as_secs_f64();

        let t = Instant::now();
        let mst = library_mst(&d);
        let mst_time = t.elapsed().as_secs_f64();
        let mst_len: f64 = mst.iter().map(|&(a, b)| d[a][b]).sum();
        assert_eq!(mst.len(), n - 1);

        let t = Instant::now();
        let mst_tour = dfs_preorder(n, &mst, 0);
        let mst_tour_time = t.elapsed().as_secs_f64();
        let t = Instant::now();
        let nn_tour = nearest_neighbour(&d, 0);
        let nn_time = t.elapsed().as_secs_f64();
        let (lm, ln) = (tour_length(&d, &mst_tour), tour_length(&d, &nn_tour));
        let gap = |l: f64| 100.0 * (l / mst_len - 1.0);
        println!("n={n:4}: MST {mst_len:.3} ({mst_time:.3}s) | MST tour {lm:.3} gap {:.2}% ({mst_tour_time:.4}s) | NN tour {ln:.3} gap {:.2}% ({nn_time:.4}s)",
                 gap(lm), gap(ln));

        std::fs::write(format!("{dir}/HW9_T2_{n}_mst_edges.txt"), mst.iter().map(|&(a, b)| format!("{} {}", a + 1, b + 1)).collect::<Vec<_>>().join("\n") + "\n").unwrap();
        save_ids(&mst_tour, &format!("{dir}/HW9_T2_{n}_mst_tour.txt"));
        save_ids(&nn_tour, &format!("{dir}/HW9_T2_{n}_nn_tour.txt"));
        std::fs::write(format!("{dir}/HW9_T2_{n}_results.json"), serde_json::to_string_pretty(&json!({
            "points": n, "distance_matrix_seconds": prep,
            "mst": {"method": "petgraph::algo::min_spanning_tree (Kruskal) on the complete Euclidean graph", "length": mst_len, "seconds": mst_time, "edges": mst.len()},
            "mst_tour": {"method": "DFS preorder from ID 1, children in increasing ID order", "length": lm, "gap_percent": gap(lm), "seconds": mst_tour_time},
            "nn_tour": {"method": "nearest neighbour from ID 1, distance ties by ID", "length": ln, "gap_percent": gap(ln), "seconds": nn_time},
        })).unwrap()).unwrap();
    }
}
