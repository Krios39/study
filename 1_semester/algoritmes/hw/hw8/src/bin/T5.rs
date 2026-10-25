use serde_json::{Value, json};

use hw8::draw::{allocation_bars, graph_grid};
use hw8::*;

const DATA: &str = "HW8_graph_data.json";

struct Run {
    name: String,
    graph: Graph,
    net: FlowNet,
    result: MaxFlow,
    side: Vec<bool>,
}

fn solve(name: &str, g: Graph) -> Run {
    let s = g.labels.iter().position(|l| l == "source" || l == "s").unwrap();
    let t = g.labels.iter().position(|l| l == "sink" || l == "t").unwrap();
    let mut net = FlowNet::new(&g);
    let result = net.edmonds_karp(s, t, 3);
    let side = net.reachable(s);
    Run { name: name.to_string(), graph: g, net, result, side }
}

fn verify(r: &Run) -> Value {
    let g = &r.graph;
    let n = g.n();
    let mut balance = vec![0.0; n];
    let mut capacity_ok = true;
    for (e, &(u, v, c)) in g.edges.iter().enumerate() {
        let f = r.net.flow(e);
        capacity_ok &= (0.0..=c).contains(&f);
        balance[u] -= f;
        balance[v] += f;
    }
    let s = r.net.edges.iter().map(|e| e.0).find(|&u| g.labels[u] == "source" || g.labels[u] == "s").unwrap();
    let t = (0..n).find(|&i| g.labels[i] == "sink" || g.labels[i] == "t").unwrap();
    let conservation = (0..n).filter(|&i| i != s && i != t).all(|i| balance[i] == 0.0);
    let one_each = (0..n).filter(|&i| g.group[i] == 1).all(|i| {
        g.edges.iter().enumerate().filter(|(_, e)| e.0 == i).map(|(k, _)| r.net.flow(k)).sum::<f64>() <= 1.0
    });
    let cut: f64 = g.edges.iter().filter(|e| r.side[e.0] && !r.side[e.1]).map(|e| e.2).sum();
    json!({"capacities": capacity_ok, "conservation": conservation, "at_most_one_session_each": one_each,
           "flow_value": -balance[s], "cut_capacity": cut, "flow_equals_cut": (-balance[s] - cut).abs() < 1e-9})
}

fn flow_dict(r: &Run) -> Value {
    let mut flow = serde_json::Map::new();
    for (k, e) in r.graph.edges.iter().enumerate() {
        let f = r.net.flow(k);
        if f > 0.0 {
            flow.entry(r.graph.labels[e.0].clone()).or_insert(json!({})).as_object_mut().unwrap().insert(r.graph.labels[e.1].clone(), json!(f));
        }
    }
    Value::Object(flow)
}

fn main() {
    let small = solve("allocation_small", Graph::load(DATA, "allocation_small"));
    let small_check = verify(&small);
    let small_paths: Vec<String> = small.result.first_paths.iter().map(|p| p.iter().map(|&i| small.graph.labels[i].clone()).collect::<Vec<_>>().join(" -> ")).collect();
    println!("small: value {} in {} augmentations, {} examinations, paths {:?}, S = {:?}, check {}", small.result.value, small.result.augmentations,
             small.result.examinations, small_paths, (0..small.graph.n()).filter(|&i| small.side[i]).map(|i| &small.graph.labels[i]).collect::<Vec<_>>(), small_check);

    let mut base = Graph::load(DATA, "allocation_large");
    let kind: Value = serde_json::from_str(&std::fs::read_to_string(DATA).unwrap()).unwrap();
    let nodes = kind["graphs"]["allocation_large"]["nodes"].as_array().unwrap();
    base.group = nodes.iter().map(|nd| match nd["kind"].as_str().unwrap() { "student" => 1, "session" => 2, _ => 0 }).collect();
    let sessions: Vec<usize> = (0..base.n()).filter(|&i| base.group[i] == 2).collect();
    let students: Vec<usize> = (0..base.n()).filter(|&i| base.group[i] == 1).collect();
    let t = (0..base.n()).find(|&i| base.labels[i] == "sink").unwrap();
    let with_seats = |name: &str, extra: f64| {
        let mut g = base.clone();
        let j = g.labels.iter().position(|l| l == name).unwrap();
        g.edges.iter_mut().filter(|e| e.0 == j && e.1 == t).for_each(|e| e.2 += extra);
        g
    };
    let runs = vec![
        solve("baseline", base.clone()),
        solve("g00 + 20 seats", with_seats("g00", 20.0)),
        solve("g04 + 20 seats", with_seats("g04", 20.0)),
    ];

    let only01: Vec<usize> = students.iter().copied().filter(|&u| base.edges.iter().filter(|e| e.0 == u).all(|e| base.labels[e.1] == "g00" || base.labels[e.1] == "g01")).collect();
    let demand: Vec<usize> = sessions.iter().map(|&j| base.edges.iter().filter(|e| e.1 == j).count()).collect();
    let mut rows = Vec::new();
    let mut panels = Vec::new();
    let mut groups = Vec::new();
    for r in &runs {
        let g = &r.graph;
        let check = verify(r);
        let caps: Vec<f64> = sessions.iter().map(|&j| g.edges.iter().find(|e| e.0 == j && e.1 == t).unwrap().2).collect();
        let assigned: Vec<f64> = sessions.iter().map(|&j| g.edges.iter().enumerate().filter(|(_, e)| e.1 == j).map(|(k, _)| r.net.flow(k)).sum()).collect();
        let unassigned: Vec<String> = students.iter().filter(|&&u| g.edges.iter().enumerate().filter(|(_, e)| e.0 == u).map(|(k, _)| r.net.flow(k)).sum::<f64>() == 0.0).map(|&u| g.labels[u].clone()).collect();
        let s_students = students.iter().filter(|&&u| r.side[u]).count();
        let s_sessions: Vec<String> = sessions.iter().filter(|&&j| r.side[j]).map(|&j| g.labels[j].clone()).collect();
        let cut_edges: Vec<(String, String, f64)> = g.edges.iter().filter(|e| r.side[e.0] && !r.side[e.1]).map(|e| (g.labels[e.0].clone(), g.labels[e.1].clone(), e.2)).collect();
        let cut_from_source = cut_edges.iter().filter(|e| e.0 == "source").count();
        let cut_to_sink: Vec<&(String, String, f64)> = cut_edges.iter().filter(|e| e.1 == "sink").collect();
        let cut_middle = cut_edges.len() - cut_from_source - cut_to_sink.len();
        let mean_len = r.result.path_lengths.iter().sum::<usize>() as f64 / r.result.augmentations.max(1) as f64;
        println!("{}: value {}, unassigned {}, seats {}, augmentations {}, examinations {}, mean path {:.2}, max path {}, S: {} students + {:?}, cut {} = {} s->student + {:?} + {} middle; {}",
                 r.name, r.result.value, unassigned.len(), caps.iter().sum::<f64>(), r.result.augmentations, r.result.examinations, mean_len,
                 r.result.path_lengths.iter().max().unwrap(), s_students, s_sessions, check["cut_capacity"], cut_from_source,
                 cut_to_sink.iter().map(|e| format!("{}:{}", e.0, e.2)).collect::<Vec<_>>(), cut_middle, check);
        panels.push((format!("{}: {} of 200 students assigned, {} seats", r.name, r.result.value, caps.iter().sum::<f64>()), caps.clone(), assigned.clone(),
                     sessions.iter().map(|&j| r.side[j]).collect::<Vec<bool>>()));

        let in_s = |set: &[usize]| set.iter().filter(|&&i| r.side[i]).count();
        let others: Vec<usize> = students.iter().copied().filter(|u| !only01.contains(u)).collect();
        let g01: Vec<usize> = sessions[..2].to_vec();
        let g2: Vec<usize> = sessions[2..].to_vec();
        let sum_flow = |from: &[usize], to: &[usize]| -> (f64, f64) {
            g.edges.iter().enumerate().filter(|(_, e)| from.contains(&e.0) && to.contains(&e.1)).fold((0.0, 0.0), |(f, c), (k, e)| (f + r.net.flow(k), c + e.2))
        };
        let src = vec![0usize];
        let snk = vec![t];
        let blocks = [src.clone(), only01.clone(), others.clone(), g01.clone(), g2.clone(), snk.clone()];
        let names = ["s".to_string(), format!("u000-u059: only g00/g01 ({}/60 in S)", in_s(&only01)), format!("u060-u199: g02-g11 ({}/140 in S)", in_s(&others)),
                     format!("g00, g01 ({}/2 in S)", in_s(&g01)), format!("g02-g11 ({}/10 in S)", in_s(&g2)), "t".to_string()];
        let pos = [(0.0, 0.0), (1.0, 1.0), (1.0, -1.0), (2.2, 1.0), (2.2, -1.0), (3.2, 0.0)];
        let links = [(0, 1), (0, 2), (1, 3), (2, 4), (3, 5), (4, 5)];
        let mut agg = Graph::from_edges(6, &links);
        agg.labels = names.to_vec();
        agg.pos = pos.to_vec();
        agg.group = blocks.iter().map(|b| if in_s(b) * 2 >= b.len() { 0 } else { 1 }).collect();
        let mut texts = Vec::new();
        let mut hot = Vec::new();
        for &(a, b) in &links {
            let (f, c) = sum_flow(&blocks[a], &blocks[b]);
            texts.push(format!("{f}/{c}"));
            let crossing: f64 = g.edges.iter().filter(|e| blocks[a].contains(&e.0) && blocks[b].contains(&e.1) && r.side[e.0] && !r.side[e.1]).map(|e| e.2).sum();
            if crossing > 0.0 {
                hot.push((a, b));
            }
        }
        groups.push((format!("{}: cut = {}", r.name, check["cut_capacity"].as_f64().unwrap()), agg, hot, texts));

        rows.push(json!({"name": r.name, "value": r.result.value, "assigned": r.result.value, "unassigned": unassigned.len(), "unassigned_students": unassigned,
                         "total_seats": caps.iter().sum::<f64>(), "sessions": sessions.iter().map(|&j| g.labels[j].clone()).collect::<Vec<_>>(),
                         "capacity": caps, "assigned_per_session": assigned, "augmentations": r.result.augmentations, "bfs_examinations": r.result.examinations,
                         "path_lengths": r.result.path_lengths, "source_side": (0..g.n()).filter(|&i| r.side[i]).map(|i| g.labels[i].clone()).collect::<Vec<_>>(),
                         "source_side_students": s_students, "source_side_sessions": s_sessions,
                         "cut": {"from_source": cut_from_source, "to_sink": cut_to_sink.iter().map(|e| json!([e.0, e.2])).collect::<Vec<_>>(), "middle": cut_middle},
                         "check": check, "flow": flow_dict(r)}));
    }
    let ymax = panels.iter().flat_map(|p| p.1.iter()).cloned().fold(0.0, f64::max) * 1.35;
    allocation_bars("HW8_T5_utilisation.svg", &sessions.iter().map(|&j| base.labels[j].clone()).collect::<Vec<_>>(), &panels, ymax);
    graph_grid("HW8_T5_cut.svg", &groups, 3);

    let out = json!({
        "small": {"value": small.result.value, "augmentations": small.result.augmentations, "bfs_examinations": small.result.examinations,
                  "paths": small_paths, "flow": flow_dict(&small), "source_side": (0..small.graph.n()).filter(|&i| small.side[i]).map(|i| small.graph.labels[i].clone()).collect::<Vec<_>>(),
                  "check": small_check},
        "demand": sessions.iter().zip(&demand).map(|(&j, &d)| json!([base.labels[j], d])).collect::<Vec<_>>(),
        "only_g00_g01": only01.len(),
        "runs": rows,
    });
    std::fs::write("HW8_T5_results.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
}
