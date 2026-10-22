use std::hint::black_box;
use std::time::Instant;

use plotters::prelude::RGBColor;
use serde_json::{Value, json};

use hw8::draw::{graph_figure, heatmap_row, timing_chart};
use hw8::*;

const DATA: &str = "HW8_graph_data.json";
const LIMIT: f64 = 5.0;

fn rows(r: &[Vec<bool>]) -> Vec<String> {
    r.iter().map(|row| row.iter().map(|&b| if b { '1' } else { '0' }).collect()).collect()
}

fn as_f64(m: &[Vec<i64>]) -> Vec<Vec<f64>> {
    m.iter().map(|r| r.iter().map(|&x| x as f64).collect()).collect()
}

fn bool_f64(m: &[Vec<bool>]) -> Vec<Vec<f64>> {
    m.iter().map(|r| r.iter().map(|&x| if x { 1.0 } else { 0.0 }).collect()).collect()
}

fn all_methods(g: &Graph) -> (Vec<Vec<bool>>, usize, bool) {
    let reference = bfs_closure(g);
    let wb = warshall_bits(g).to_vec();
    let ws = warshall_scalar(g);
    let (sb, k) = squaring_bits(g);
    let (ss, k2) = squaring_scalar(g);
    let same = wb == reference && ws == reference && sb.to_vec() == reference && ss == reference && k == k2;
    let diagonal = (0..g.n()).all(|i| wb[i][i]);
    (wb, k, same && diagonal)
}

fn boolean_power(g: &Graph, p: usize) -> Vec<Vec<bool>> {
    let mut a = BitMatrix::new(g.n());
    for &(u, v, _) in &g.edges {
        a.set(u, v);
    }
    let mut r = BitMatrix::identity(g.n());
    for _ in 0..p {
        r = r.boolean_product(&a);
    }
    r.to_vec()
}

fn time_once(method: usize, g: &Graph) -> (f64, usize) {
    let t = Instant::now();
    let k = match method {
        0 => { black_box(warshall_bits(black_box(g))); 0 }
        1 => { black_box(warshall_scalar(black_box(g))); 0 }
        2 => black_box(squaring_bits(black_box(g))).1,
        _ => black_box(squaring_scalar(black_box(g))).1,
    };
    (t.elapsed().as_secs_f64(), k)
}

fn main() {
    let web = Graph::load(DATA, "web_base");
    let n = web.n();
    let a = web.adjacency();
    let a2 = int_product(&a, &a);
    let a3 = int_product(&a2, &a);

    let walks3 = |s: usize, t: usize| {
        let mut w = Vec::new();
        for x in 0..n {
            for y in 0..n {
                if a[s][x] * a[x][y] * a[y][t] == 1 {
                    w.push(vec![s, x, y, t]);
                }
            }
        }
        w
    };
    let walks = walks3(0, 4);
    let revisit = walks3(1, 4);
    println!("A^3[1][4] = {}, walks {:?}", a3[1][4], revisit);
    let simple = walks.iter().filter(|w| { let mut s = (*w).clone(); s.sort(); s.dedup(); s.len() == 4 }).count();
    println!("A^3[0][4] = {}, enumerated walks = {}", a3[0][4], walks.len());
    for w in &walks {
        let names: Vec<&str> = w.iter().map(|&i| web.labels[i].as_str()).collect();
        println!("  {:?}  {}", w, names.join(" -> "));
    }

    let (closure, squarings, ok) = all_methods(&web);
    println!("mini-web: all closures equal BFS with true diagonal: {ok}, squarings = {squarings}");
    let sccs = scc_groups(&closure);
    for s in &sccs {
        let names: Vec<&str> = s.iter().map(|&i| web.labels[i].as_str()).collect();
        println!("  SCC {:?} {:?}", s, names);
    }

    let one_product = {
        let mut ia = BitMatrix::reflexive_adjacency(&web);
        ia = ia.boolean_product(&ia);
        ia.to_vec()
    };
    let an = boolean_power(&web, n);
    let r_ones: usize = closure.iter().flatten().filter(|&&b| b).count();
    let one_ones: usize = one_product.iter().flatten().filter(|&&b| b).count();
    let an_ones: usize = an.iter().flatten().filter(|&&b| b).count();
    let an_missed: Vec<(usize, usize)> = (0..n).flat_map(|i| (0..n).map(move |j| (i, j)))
        .filter(|&(i, j)| closure[i][j] && !an[i][j]).collect();
    let an_diag = (0..n).filter(|&i| an[i][i]).count();
    println!("true entries: R = {r_ones}, (I|A)^2 = {one_ones}, A^{n} > 0 = {an_ones}, missed by A^{n}: {}", an_missed.len());

    let chain = Graph::from_edges(17, &(0..16).map(|i| (i, i + 1)).collect::<Vec<_>>());
    let cyc = Graph::from_edges(3, &[(0, 1), (1, 0)]);
    let (chain_r, chain_k, chain_ok) = all_methods(&chain);
    let (cyc_r, cyc_k, cyc_ok) = all_methods(&cyc);
    let chain_upper = (0..17).all(|i| (0..17).all(|j| chain_r[i][j] == (i <= j)));
    println!("chain17: ok {chain_ok}, upper-triangular {chain_upper}, squarings {chain_k}; cycle+isolate: ok {cyc_ok}, squarings {cyc_k}, R = {:?}", rows(&cyc_r));

    let names = ["Warshall, bit rows", "Warshall, scalar bool", "Squaring, bit rows", "Squaring, scalar bool"];
    let colors = [RGBColor(37, 99, 235), RGBColor(147, 197, 253), RGBColor(220, 38, 38), RGBColor(252, 165, 165)];
    let sizes = [64usize, 128, 256, 512];
    let mut stopped = [false; 4];
    let mut timing = Vec::new();
    let mut series: Vec<(String, Vec<(f64, f64)>, RGBColor)> = names.iter().zip(colors).map(|(s, c)| (s.to_string(), Vec::new(), c)).collect();
    let mut cluster_checks = Vec::new();
    for &size in &sizes {
        let g = Graph::load(DATA, &format!("clusters_{size}"));
        let (r, k, ok) = all_methods(&g);
        let groups = scc_groups(&r);
        let ones: usize = r.iter().flatten().filter(|&&b| b).count();
        cluster_checks.push(json!({"n": size, "edges": g.edges.len(), "methods_agree_with_bfs": ok, "squarings": k,
                                   "scc_sizes": groups.iter().map(Vec::len).collect::<Vec<_>>(), "reachable_pairs": ones,
                                   "closure": rows(&r)}));
        for m in 0..4 {
            if stopped[m] {
                timing.push(json!({"method": names[m], "n": size, "status": format!("omitted: an earlier run exceeded {LIMIT} s")}));
                continue;
            }
            let mut times = Vec::new();
            let mut sq = 0;
            for _ in 0..3 {
                let (t, k) = time_once(m, &g);
                times.push(t);
                sq = k;
                if t > LIMIT {
                    stopped[m] = true;
                    break;
                }
            }
            let status = if times.len() < 3 { format!("stopped after run {} took {:.2} s", times.len(), times.last().unwrap()) } else { "3 runs".to_string() };
            let mut sorted = times.clone();
            sorted.sort_by(f64::total_cmp);
            let median = if sorted.len() == 3 { Some(sorted[1]) } else { None };
            if let Some(md) = median {
                series[m].1.push((size as f64, md));
            }
            println!("n={size:4} {:24} median {:?} runs {:?} squarings {}", names[m], median, times, sq);
            timing.push(json!({"method": names[m], "n": size, "runs": times, "median": median, "squarings": if m >= 2 { Value::from(sq) } else { Value::Null }, "status": status}));
        }
    }

    let walk_edges: Vec<(usize, usize)> = walks.iter().flat_map(|w| w.windows(2).map(|p| (p[0], p[1])).collect::<Vec<_>>()).collect();
    graph_figure("HW8_T1_web.jpg", &web, "Base mini-web: edge weights (red: edges of the length-3 walks 0 -> 4)", &walk_edges);
    heatmap_row("HW8_T1_powers.jpg", &[("A", as_f64(&a), None), ("A^2 (walks of length 2)", as_f64(&a2), None), ("A^3 (walks of length 3), red: [0][4]", as_f64(&a3), Some((0, 4)))],
                Some(&web.labels), true, (680, 590));
    heatmap_row("HW8_T1_closure.jpg", &[("A (edge exists)", as_f64(&a), None), ("R = reflexive transitive closure", bool_f64(&closure), None)],
                Some(&web.labels), false, (680, 590));
    let big = Graph::load(DATA, "clusters_256");
    let big_r = warshall_bits(&big).to_vec();
    heatmap_row("HW8_T1_clusters256.jpg", &[("clusters_256: A", as_f64(&big.adjacency()), None), ("clusters_256: closure R", bool_f64(&big_r), None)], None, false, (660, 660));
    timing_chart("HW8_T1_timing.jpg", &series, LIMIT);

    let out = json!({
        "nodes": (0..n).collect::<Vec<_>>(), "labels": web.labels,
        "A": a, "A2": a2, "A3": a3,
        "walks_0_to_4": walks, "walk_count": walks.len(), "simple_paths_among_them": simple, "A3_0_4": a3[0][4],
        "walks_1_to_4": revisit, "A3_1_4": a3[1][4],
        "closure": rows(&closure), "squarings": squarings, "methods_agree_with_bfs": ok,
        "scc": sccs, "true_entries": {"closure": r_ones, "one_product_I_or_A_squared": one_ones, "A_power_n_positive": an_ones,
                                       "A_power_n_missed": an_missed, "A_power_n_diagonal_true": an_diag},
        "chain17": {"closure": rows(&chain_r), "squarings": chain_k, "ok": chain_ok && chain_upper},
        "cycle_isolate": {"closure": rows(&cyc_r), "squarings": cyc_k, "ok": cyc_ok},
        "clusters": cluster_checks, "timing": timing, "limit_seconds": LIMIT,
    });
    std::fs::write("HW8_T1_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
}
