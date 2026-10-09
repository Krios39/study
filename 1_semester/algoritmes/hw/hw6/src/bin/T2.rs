use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::fs;

type Graph = BTreeMap<String, Vec<String>>;

fn load_graph(path: &str) -> Graph {
    let text = fs::read_to_string(path).expect("cannot read graph JSON");
    serde_json::from_str(&text).expect("bad graph JSON")
}

fn bfs(graph: &Graph, source: &str, target: Option<&str>) -> BTreeMap<String, String> {
    let mut parent = BTreeMap::new();
    let mut queue = VecDeque::new();
    parent.insert(source.to_string(), source.to_string());
    queue.push_back(source.to_string());

    while let Some(u) = queue.pop_front() {
        let mut next: Vec<&String> = graph[&u].iter().collect();
        next.sort();
        for v in next {
            if parent.contains_key(v) {
                continue;
            }
            parent.insert(v.clone(), u.clone());
            if Some(v.as_str()) == target {
                return parent;
            }
            queue.push_back(v.clone());
        }
    }
    parent
}

fn shortest_path(graph: &Graph, source: &str, target: &str) -> Option<Vec<String>> {
    let parent = bfs(graph, source, Some(target));
    if !parent.contains_key(target) {
        return None;
    }
    let mut path = vec![target.to_string()];
    while path.last().unwrap() != source {
        let p = parent[path.last().unwrap()].clone();
        path.push(p);
    }
    path.reverse();
    Some(path)
}

fn differs_by_one(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).filter(|(x, y)| x != y).count() == 1
}

fn check_ladder(graph: &Graph, path: &[String], source: &str, target: &str) -> Result<(), String> {
    if path.first().map(String::as_str) != Some(source) || path.last().map(String::as_str) != Some(target) {
        return Err("wrong endpoints".into());
    }
    for w in path {
        if !graph.contains_key(w) {
            return Err(format!("{w} is not in the dictionary"));
        }
    }
    for pair in path.windows(2) {
        if !differs_by_one(&pair[0], &pair[1]) {
            return Err(format!("{} -> {} is not a one-letter change", pair[0], pair[1]));
        }
    }
    Ok(())
}

fn print_ladder(graph: &Graph, source: &str, target: &str) {
    match shortest_path(graph, source, target) {
        Some(path) => {
            let check = match check_ladder(graph, &path, source, target) {
                Ok(()) => "OK".to_string(),
                Err(e) => format!("FAILED: {e}"),
            };
            println!("{source} -> {target}: {} ({} edges), check {check}", path.join(" -> "), path.len() - 1);
        }
        None => println!("{source} -> {target}: no path"),
    }
}

fn main() {
    let graph = load_graph("HW6_word_graph.json");

    // ---- Statistics ----
    let vertices = graph.len();
    let degree_sum: usize = graph.values().map(Vec::len).sum();
    let edges = degree_sum / 2;
    let isolated = graph.values().filter(|adj| adj.is_empty()).count();

    // Connected components: BFS from every unvisited word, in alphabetical order
    let mut component_of: BTreeMap<String, usize> = BTreeMap::new();
    let mut components: Vec<Vec<String>> = Vec::new();
    for word in graph.keys() {
        if component_of.contains_key(word) {
            continue;
        }
        let members: Vec<String> = bfs(&graph, word, None).into_keys().collect();
        for m in &members {
            component_of.insert(m.clone(), components.len());
        }
        components.push(members);
    }
    let mut sizes: Vec<usize> = components.iter().map(Vec::len).collect();
    sizes.sort_unstable_by(|a, b| b.cmp(a));

    println!("=== Statistics ===");
    println!("Vertices:            {vertices}");
    println!("Undirected edges:    {edges}");
    println!("Components:          {}", components.len());
    println!("Isolated vertices:   {isolated}");
    println!("Largest component:   {}", sizes[0]);
    println!("Second largest:      {}", sizes[1]);

    let mut by_size: BTreeMap<usize, usize> = BTreeMap::new();
    for s in &sizes {
        *by_size.entry(*s).or_default() += 1;
    }
    println!("Component sizes (size: count): {by_size:?}");

    println!("\n=== Ladders ===");
    print_ladder(&graph, "sport", "spice");
    print_ladder(&graph, "shore", "skirt");

    let largest = component_of["sport"];
    let second = components
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != largest)
        .max_by_key(|(i, c)| (c.len(), std::cmp::Reverse(*i)))
        .unwrap();
    println!("\n=== Unreachable pair ===");
    println!("sport is in a component of size {}", components[largest].len());
    println!("Second largest component: {:?}", second.1);
    let other = &second.1[0];
    print_ladder(&graph, "sport", other);
    println!("Words reached from sport: {}", bfs(&graph, "sport", None).len());

    for s in ["sport", "shore"] {
        let parent = bfs(&graph, s, None);
        let mut depth: BTreeMap<String, usize> = BTreeMap::new();
        depth.insert(s.to_string(), 0);
        fn d(w: &str, parent: &BTreeMap<String, String>, depth: &mut BTreeMap<String, usize>) -> usize {
            if let Some(&x) = depth.get(w) {
                return x;
            }
            let p = parent[w].clone();
            let x = d(&p, parent, depth) + 1;
            depth.insert(w.to_string(), x);
            x
        }
        let max = parent.keys().map(|w| d(w, &parent, &mut depth)).max().unwrap();
        println!("BFS tree depth from {s}: {max}");
    }

    let small = load_graph("HW6_word_graph_100.json");
    let words: Vec<&String> = small.keys().collect();
    let mut helper_edges = BTreeSet::new();
    for (u, adj) in &small {
        for v in adj {
            helper_edges.insert(if u < v { (u.clone(), v.clone()) } else { (v.clone(), u.clone()) });
        }
    }
    let mut direct_edges = BTreeSet::new();
    for i in 0..words.len() {
        for j in i + 1..words.len() {
            if differs_by_one(words[i], words[j]) {
                direct_edges.insert((words[i].clone(), words[j].clone()));
            }
        }
    }
    println!("\n=== Builder cross-check on words[:100] ===");
    println!("First word: {}, last word: {}", words[0], words[words.len() - 1]);
    println!("Helper edges: {}", helper_edges.len());
    println!("Direct pairwise edges: {}", direct_edges.len());
    println!("Only in helper: {:?}", helper_edges.difference(&direct_edges).collect::<Vec<_>>());
    println!("Only in direct: {:?}", direct_edges.difference(&helper_edges).collect::<Vec<_>>());
    println!("Match: {}", helper_edges == direct_edges);
    println!("Edges: {:?}", direct_edges);
}
