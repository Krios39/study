use serde_json::json;

use hw8::draw::graph_grid;
use hw8::*;

const DATA: &str = "HW8_graph_data.json";

fn flow_graph(g: &Graph, net: &FlowNet) -> (Graph, Vec<String>, Vec<(usize, usize)>) {
    let texts = (0..g.edges.len()).map(|e| format!("{}/{}", net.flow(e), g.edges[e].2)).collect();
    let used = (0..g.edges.len()).filter(|&e| net.flow(e) > 0.0).map(|e| (g.edges[e].0, g.edges[e].1)).collect();
    (g.clone(), texts, used)
}

fn residual_graph(g: &Graph, net: &FlowNet) -> (Graph, Vec<String>) {
    let mut r = g.clone();
    let res = net.residual_edges();
    r.edges = res.iter().map(|&(u, v, c, _)| (u, v, c)).collect();
    let texts = res.iter().map(|&(_, _, c, original)| if original { format!("{c}") } else { format!("{c} rev") }).collect();
    (r, texts)
}

fn simple_paths(net: &FlowNet, s: usize, t: usize) -> Vec<Vec<usize>> {
    fn rec(net: &FlowNet, path: &mut Vec<usize>, t: usize, out: &mut Vec<Vec<usize>>) {
        let u = *path.last().unwrap();
        if u == t {
            out.push(path.clone());
            return;
        }
        for a in &net.adj[u] {
            if a.residual > 0.0 && !path.contains(&a.to) {
                path.push(a.to);
                rec(net, path, t, out);
                path.pop();
            }
        }
    }
    let mut out = Vec::new();
    rec(net, &mut vec![s], t, &mut out);
    out
}

fn main() {
    let g = Graph::load(DATA, "allocation_small");
    let id = |name: &str| g.labels.iter().position(|l| l == name).unwrap();
    let (s, t) = (id("s"), id("t"));
    let name = |p: &[usize]| p.iter().map(|&i| g.labels[i].clone()).collect::<Vec<_>>().join(" -> ");
    let pairs = |p: &[usize]| p.windows(2).map(|w| (w[0], w[1])).collect::<Vec<_>>();
    let mut net = FlowNet::new(&g);
    let mut panels = Vec::new();

    let path1: Vec<usize> = ["s", "A", "X", "t"].iter().map(|x| id(x)).collect();
    let (g0, t0, _) = flow_graph(&g, &net);
    panels.push(("1. Capacities (flow/capacity); first path s-A-X-t".to_string(), g0, pairs(&path1), t0));
    let before1 = simple_paths(&net, s, t);
    let b1 = net.augment_path(&path1);
    let (g1, t1, u1) = flow_graph(&g, &net);
    panels.push((format!("2. After augmentation 1 (+{b1}): A takes X"), g1, u1, t1));

    let options = simple_paths(&net, s, t);
    let path2: Vec<usize> = ["s", "B", "X", "A", "Y", "t"].iter().map(|x| id(x)).collect();
    assert_eq!(options, vec![path2.clone()]);
    let (r1, rt1) = residual_graph(&g, &net);
    panels.push(("3. Residual after 1; path 2 uses X-A backwards".to_string(), r1, pairs(&path2), rt1));
    let b2 = net.augment_path(&path2);
    let (g2, t2, u2) = flow_graph(&g, &net);
    panels.push((format!("4. After augmentation 2 (+{b2}): A moves to Y, B takes X"), g2, u2, t2));

    let (r2, rt2) = residual_graph(&g, &net);
    let reach = net.reachable(s);
    let left = simple_paths(&net, s, t);
    panels.push(("5. Final residual: no path from s to t".to_string(), r2, Vec::new(), rt2));
    let side: Vec<usize> = (0..g.n()).filter(|&i| reach[i]).collect();
    let mut gc = g.clone();
    gc.group = (0..g.n()).map(|i| if reach[i] { 0 } else { 1 }).collect();
    let cut: Vec<(usize, usize)> = g.edges.iter().filter(|e| reach[e.0] && !reach[e.1]).map(|e| (e.0, e.1)).collect();
    let cut_cap: f64 = g.edges.iter().filter(|e| reach[e.0] && !reach[e.1]).map(|e| e.2).sum();
    let (_, t3, _) = flow_graph(&g, &net);
    panels.push((format!("6. Cut S = {{{}}} (yellow): capacity {cut_cap}", side.iter().map(|&i| g.labels[i].clone()).collect::<Vec<_>>().join(", ")), gc, cut.clone(), t3));
    graph_grid("HW8_T4_trace.svg", &panels, 3);

    let value: f64 = g.edges.iter().enumerate().filter(|(_, e)| e.0 == s).map(|(k, _)| net.flow(k)).sum();
    let mut flow = serde_json::Map::new();
    for (k, e) in g.edges.iter().enumerate() {
        flow.entry(g.labels[e.0].clone()).or_insert(json!({})).as_object_mut().unwrap().insert(g.labels[e.1].clone(), json!(net.flow(k)));
    }
    let all_cuts: Vec<(Vec<String>, f64)> = (0..1u32 << g.n()).filter(|m| m >> s & 1 == 1 && m >> t & 1 == 0).map(|m| {
        let inside = |i: usize| m >> i & 1 == 1;
        let cap: f64 = g.edges.iter().filter(|e| inside(e.0) && !inside(e.1)).map(|e| e.2).sum();
        ((0..g.n()).filter(|&i| inside(i)).map(|i| g.labels[i].clone()).collect(), cap)
    }).collect();
    let minimum: Vec<&Vec<String>> = all_cuts.iter().filter(|c| c.1 == value).map(|c| &c.0).collect();
    println!("paths before 1: {:?}", before1.iter().map(|p| name(p)).collect::<Vec<_>>());
    println!("path 1 {} (+{b1}), path 2 {} (+{b2}), value {value}, residual paths left {}, S = {:?}, cut {cut_cap}, all minimum cuts {:?}",
             name(&path1), name(&path2), left.len(), side, minimum);
    let out = json!({
        "paths_initially": before1.iter().map(|p| name(p)).collect::<Vec<_>>(),
        "path1": name(&path1), "bottleneck1": b1, "residual_paths_after_1": options.iter().map(|p| name(p)).collect::<Vec<_>>(),
        "path2": name(&path2), "bottleneck2": b2, "flow": flow, "value": value,
        "source_side": side.iter().map(|&i| g.labels[i].clone()).collect::<Vec<_>>(), "cut_edges": cut.iter().map(|&(u, v)| format!("{} -> {}", g.labels[u], g.labels[v])).collect::<Vec<_>>(),
        "cut_capacity": cut_cap, "minimum_cuts": minimum,
    });
    std::fs::write("HW8_T4_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
}
