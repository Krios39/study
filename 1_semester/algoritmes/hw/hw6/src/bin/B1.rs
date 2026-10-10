use std::cmp::Reverse;
use std::collections::{BTreeMap, BTreeSet, BinaryHeap};
use std::fs;

type Graph = BTreeMap<String, Vec<String>>;
type Weighted = BTreeMap<String, Vec<(String, u64)>>;

fn diff(a: &str, b: &str) -> usize {
    a.bytes().zip(b.bytes()).filter(|(x, y)| x != y).count()
}

fn build(words: &[String], cost: impl Fn(usize) -> Option<u64>) -> Weighted {
    let mut g: Weighted = words.iter().map(|w| (w.clone(), Vec::new())).collect();
    for i in 0..words.len() {
        for j in i + 1..words.len() {
            if let Some(c) = cost(diff(&words[i], &words[j])) {
                g.get_mut(&words[i]).unwrap().push((words[j].clone(), c));
                g.get_mut(&words[j]).unwrap().push((words[i].clone(), c));
            }
        }
    }
    g
}

fn dijkstra(g: &Weighted, s: &str, t: &str) -> Option<(Vec<String>, u64)> {
    let mut dist: BTreeMap<&str, u64> = BTreeMap::new();
    let mut parent: BTreeMap<&str, &str> = BTreeMap::new();
    let mut done: BTreeSet<&str> = BTreeSet::new();
    let mut heap = BinaryHeap::new();
    dist.insert(s, 0);
    heap.push(Reverse((0u64, s)));
    while let Some(Reverse((d, u))) = heap.pop() {
        if done.contains(u) || d != dist[u] {
            continue;
        }
        done.insert(u);
        if u == t {
            let mut path = vec![t.to_string()];
            let mut x = t;
            while x != s {
                x = parent[x];
                path.push(x.to_string());
            }
            path.reverse();
            return Some((path, d));
        }
        for (v, w) in &g[u] {
            let nd = d + w;
            if !done.contains(v.as_str()) && dist.get(v.as_str()).is_none_or(|&old| nd < old) {
                dist.insert(v, nd);
                parent.insert(v, u);
                heap.push(Reverse((nd, v)));
            }
        }
    }
    None
}

fn check(g: &Weighted, path: &[String], cost: &impl Fn(usize) -> Option<u64>) -> u64 {
    for (u, adj) in g {
        for (v, w) in adj {
            assert_eq!(cost(diff(u, v)), Some(*w), "bad edge {u}-{v}");
        }
    }
    path.windows(2).map(|p| {
        let w = g[&p[0]].iter().find(|(v, _)| *v == p[1]).expect("missing edge").1;
        assert_eq!(cost(diff(&p[0], &p[1])), Some(w));
        w
    }).sum()
}

fn show(path: &[String]) -> String {
    path.windows(2).map(|p| format!("{} -({})-> ", p[0], diff(&p[0], &p[1]))).collect::<String>() + path.last().unwrap()
}

fn main() {
    let full: Graph = serde_json::from_str(&fs::read_to_string("HW6_word_graph.json").unwrap()).unwrap();

    let required = ["sport", "spirt", "spire", "spice", "shore", "shire", "shirt", "skirt"];
    let mut set: BTreeSet<String> = required.iter().map(|w| w.to_string()).collect();
    for w in required {
        set.extend(full[w].iter().cloned());
    }
    set.retain(|w| w != "shite" && w != "whore");
    let words: Vec<String> = set.into_iter().take(100).collect();
    assert!(required.iter().all(|w| words.contains(&w.to_string())));
    println!("Selected words ({}): {}", words.len(), words.join(", "));

    let cost1 = |d: usize| if d == 1 { Some(13) } else { None };
    let cost2 = |d: usize| if (1..=3).contains(&d) { Some(8 * d as u64 + 5) } else { None };
    let g1 = build(&words, cost1);
    let g2 = build(&words, cost2);
    let edges = |g: &Weighted| g.values().map(Vec::len).sum::<usize>() / 2;
    println!("Graph 1 (d = 1, cost 13): {} edges", edges(&g1));
    println!("Graph 2 (d = 1..3, cost 8d + 5): {} edges", edges(&g2));

    let mut cheaper = Vec::new();
    for s in &words {
        for t in &words {
            if s < t {
                if let (Some((_, c1)), Some((_, c2))) = (dijkstra(&g1, s, t), dijkstra(&g2, s, t)) {
                    if c2 < c1 {
                        cheaper.push((c1 - c2, s.clone(), t.clone()));
                    }
                }
            }
        }
    }
    cheaper.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    println!("Pairs cheaper in graph 2: {}; largest saving: {:?}", cheaper.len(), &cheaper[..3.min(cheaper.len())]);

    for (s, t) in [("sport", "spice"), ("shore", "skirt"), (cheaper[0].1.as_str(), cheaper[0].2.as_str())] {
        let (p1, c1) = dijkstra(&g1, s, t).unwrap();
        let (p2, c2) = dijkstra(&g2, s, t).unwrap();
        assert_eq!(check(&g1, &p1, &cost1), c1);
        assert_eq!(check(&g2, &p2, &cost2), c2);
        println!("\nPuzzle {s} -> {t}");
        println!("  graph 1: {}  cost {c1}", show(&p1));
        println!("  graph 2: {}  cost {c2}", show(&p2));
    }
    println!("\nAll edge and path checks passed");
}
