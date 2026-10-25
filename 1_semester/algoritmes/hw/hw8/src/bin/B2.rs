use serde_json::json;

use hw8::draw::graph_grid;
use hw8::*;

const SEED: u64 = 20261026;
const VARIANTS: usize = 50;

fn build(names: &[&str], pos: &[(f64, f64)], edges: &[(usize, usize, f64)]) -> Graph {
    let mut g = Graph::from_edges(names.len(), &edges.iter().map(|e| (e.0, e.1)).collect::<Vec<_>>());
    g.labels = names.iter().map(|s| s.to_string()).collect();
    g.pos = pos.to_vec();
    g.edges = edges.to_vec();
    g
}

fn contract(g: &Graph) -> (Graph, Vec<usize>, Vec<Vec<usize>>) {
    let comps = scc_groups(&bfs_closure(g));
    let mut of = vec![0; g.n()];
    for (c, members) in comps.iter().enumerate() {
        members.iter().for_each(|&v| of[v] = c);
    }
    let mut edges: Vec<(usize, usize, f64)> = Vec::new();
    for &(u, v, c) in &g.edges {
        let (a, b) = (of[u], of[v]);
        if a != b {
            match edges.iter_mut().find(|e| e.0 == a && e.1 == b) {
                Some(e) => e.2 += c,
                None => edges.push((a, b, c)),
            }
        }
    }
    let labels: Vec<String> = comps.iter().map(|m| if m.len() == 1 { g.labels[m[0]].clone() } else { m.iter().map(|&v| g.labels[v].clone()).collect::<Vec<_>>().join("") }).collect();
    let pos = comps.iter().map(|m| (m.iter().map(|&v| g.pos[v].0).sum::<f64>() / m.len() as f64, m.iter().map(|&v| g.pos[v].1).sum::<f64>() / m.len() as f64)).collect();
    let h = Graph { name: String::new(), labels, pos, group: vec![0; comps.len()], edges };
    (h, of, comps)
}

fn max_flow(g: &Graph, s: usize, t: usize) -> (f64, FlowNet, Vec<bool>) {
    let mut net = FlowNet::new(g);
    let r = net.edmonds_karp(s, t, 0);
    let side = net.reachable(s);
    (r.value, net, side)
}

fn panel(title: String, g: &Graph, net: &FlowNet, side: &[bool]) -> (String, Graph, Vec<(usize, usize)>, Vec<String>) {
    let mut d = g.clone();
    d.group = side.iter().map(|&x| if x { 0 } else { 1 }).collect();
    let texts = (0..g.edges.len()).map(|e| format!("{}/{}", net.flow(e), g.edges[e].2)).collect();
    let hot = g.edges.iter().filter(|e| side[e.0] && !side[e.1]).map(|e| (e.0, e.1)).collect();
    (title, d, hot, texts)
}

fn study(name: &str, g: &Graph, panels: &mut Vec<(String, Graph, Vec<(usize, usize)>, Vec<String>)>) -> serde_json::Value {
    let (s, t) = (0, g.n() - 1);
    let (h, of, comps) = contract(g);
    let (fo, no, so) = max_flow(g, s, t);
    let (fc, nc, sc) = max_flow(&h, of[s], of[t]);
    let side_names = |gr: &Graph, side: &[bool]| (0..gr.n()).filter(|&i| side[i]).map(|i| gr.labels[i].clone()).collect::<Vec<_>>();
    let cut = |gr: &Graph, side: &[bool]| gr.edges.iter().filter(|e| side[e.0] && !side[e.1]).map(|e| format!("{} -> {} ({})", gr.labels[e.0], gr.labels[e.1], e.2)).collect::<Vec<_>>();
    println!("{name}: SCCs {:?}; original flow {fo}, cut {:?} = {:?}; contracted flow {fc}, cut {:?} = {:?}", comps, side_names(g, &so), cut(g, &so), side_names(&h, &sc), cut(&h, &sc));
    panels.push(panel(format!("{name}: original, max flow {fo}"), g, &no, &so));
    panels.push(panel(format!("{name}: SCCs contracted, max flow {fc}"), &h, &nc, &sc));
    let flows = |gr: &Graph, net: &FlowNet| (0..gr.edges.len()).map(|e| json!([gr.labels[gr.edges[e].0], gr.labels[gr.edges[e].1], gr.edges[e].2, net.flow(e)])).collect::<Vec<_>>();
    json!({"nodes": g.labels, "edges": g.edges.iter().map(|e| json!([g.labels[e.0], g.labels[e.1], e.2])).collect::<Vec<_>>(),
           "sccs": comps.iter().map(|m| m.iter().map(|&v| g.labels[v].clone()).collect::<Vec<_>>()).collect::<Vec<_>>(),
           "original": {"value": fo, "source_side": side_names(g, &so), "cut": cut(g, &so), "flow": flows(g, &no)},
           "contracted": {"nodes": h.labels, "value": fc, "source_side": side_names(&h, &sc), "cut": cut(&h, &sc), "flow": flows(&h, &nc)}})
}

fn search(n: usize, max_cap: u64) -> serde_json::Value {
    let pairs: Vec<(usize, usize)> = (0..n).flat_map(|u| (0..n).filter(move |&v| v != u).map(move |v| (u, v))).collect();
    let names: Vec<String> = (0..n).map(|i| if i == 0 { "s".to_string() } else if i == n - 1 { "t".to_string() } else { ((b'w' + i as u8) as char).to_string() }).collect();
    let (mut checked, mut skipped, mut found) = (0usize, 0usize, Vec::new());
    for mask in 0u32..1 << pairs.len() {
        let chosen: Vec<(usize, usize)> = (0..pairs.len()).filter(|&k| mask >> k & 1 == 1).map(|k| pairs[k]).collect();
        let m = chosen.len();
        for code in 0..max_cap.pow(m as u32) {
            let mut c = code;
            let edges: Vec<(usize, usize, f64)> = chosen.iter().map(|&(u, v)| { let cap = 1 + c % max_cap; c /= max_cap; (u, v, cap as f64) }).collect();
            let g = Graph { name: String::new(), labels: names.clone(), pos: vec![(0.0, 0.0); n], group: vec![0; n], edges: edges.clone() };
            let (h, of, _) = contract(&g);
            if of[0] == of[n - 1] {
                skipped += 1;
                continue;
            }
            checked += 1;
            let (fo, _, _) = max_flow(&g, 0, n - 1);
            let (fc, _, _) = max_flow(&h, of[0], of[n - 1]);
            if fc > fo {
                found.push((m, edges.iter().map(|e| e.2).sum::<f64>(), edges, fo, fc));
            }
        }
    }
    let best = found.iter().map(|f| (f.0, f.1 as u64)).min();
    let minimal: Vec<serde_json::Value> = found.iter().filter(|f| Some((f.0, f.1 as u64)) == best).map(|f| json!({
        "edges": f.2.iter().map(|e| format!("{} -> {} ({})", names[e.0], names[e.1], e.2)).collect::<Vec<_>>(), "original": f.3, "contracted": f.4})).collect();
    println!("search n = {n}, capacities 1..{max_cap}: {checked} graphs checked ({skipped} skipped: s and t in one SCC), {} counterexamples, minimum (edges, capacity) {:?}, {} minimal: {:?}",
             found.len(), best, minimal.len(), minimal.iter().map(|m| m["edges"].clone()).collect::<Vec<_>>());
    json!({"vertices": n, "max_capacity": max_cap, "checked": checked, "skipped_same_scc": skipped, "counterexamples": found.len(),
           "minimum_edges": best.map(|b| b.0), "minimum_total_capacity": best.map(|b| b.1), "minimal": minimal})
}

fn main() {
    let names = ["s", "a", "b", "c", "d", "t"];
    let pos = [(0.0, 0.0), (1.0, 1.0), (2.0, 1.6), (2.4, 0.5), (1.4, -1.0), (3.4, 0.0)];
    let topology = [(0, 1), (0, 4), (1, 2), (2, 3), (3, 1), (3, 5), (4, 2), (4, 5)];
    let caps = [8.0, 3.0, 2.0, 8.0, 8.0, 8.0, 4.0, 2.0];
    let edges: Vec<(usize, usize, f64)> = topology.iter().zip(caps).map(|(&(u, v), c)| (u, v, c)).collect();
    let main_graph = build(&names, &pos, &edges);
    let minimal = build(&["s", "x", "t"], &[(0.0, 0.0), (1.2, 0.0), (2.4, 0.0)], &[(0, 1, 1.0), (1, 0, 1.0), (1, 2, 2.0)]);
    let mut panels = Vec::new();
    let main_res = study("example", &main_graph, &mut panels);
    let mut panels_min = Vec::new();
    let min_res = study("minimal", &minimal, &mut panels_min);
    graph_grid("HW8_B2_example.svg", &panels, 2);
    graph_grid("HW8_B2_minimal.svg", &panels_min, 2);

    let mut rng = SplitMix64(SEED);
    let mut variants = Vec::new();
    for _ in 0..VARIANTS {
        let caps: Vec<f64> = topology.iter().map(|_| (1 + rng.next() % 10) as f64).collect();
        let edges: Vec<(usize, usize, f64)> = topology.iter().zip(&caps).map(|(&(u, v), &c)| (u, v, c)).collect();
        let g = build(&names, &pos, &edges);
        let (h, of, _) = contract(&g);
        let (fo, _, _) = max_flow(&g, 0, 5);
        let (fc, _, _) = max_flow(&h, of[0], of[5]);
        variants.push(json!({"capacities": caps, "original": fo, "contracted": fc}));
    }
    let agree = variants.iter().filter(|v| v["original"] == v["contracted"]).count();
    let gap = variants.iter().map(|v| v["contracted"].as_f64().unwrap() - v["original"].as_f64().unwrap()).fold(0.0, f64::max);
    let under = variants.iter().filter(|v| v["contracted"].as_f64().unwrap() < v["original"].as_f64().unwrap()).count();
    println!("{VARIANTS} variants (seed {SEED}, capacities 1..10): agree {agree}, largest gap {gap}, contracted below original {under}");
    let searches = vec![search(2, 4), search(3, 3), search(4, 2)];
    std::fs::write("HW8_B2_results.json", serde_json::to_string_pretty(&json!({
        "example": main_res, "minimal": min_res, "seed": SEED, "capacity_range": [1, 10], "topology": topology.iter().map(|&(u, v)| format!("{} -> {}", names[u], names[v])).collect::<Vec<_>>(),
        "variants": variants, "searches": searches, "agree": agree, "largest_gap": gap, "contracted_below_original": under,
    })).unwrap()).unwrap();
}
