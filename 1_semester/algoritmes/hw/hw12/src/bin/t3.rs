use std::fs;

use hw12::draw::{svg, Node};
use hw12::search::reference;
use hw12::suffix::{internal_names, leaves, tree, tree_walk, trie, trie_walk, Walk};
use serde_json::json;

const TEXT: &[u8] = b"bananabananabandanas$";
const PATTERNS: [(&str, &str); 3] = [("ana", "#1d4ed8"), ("band", "#15803d"), ("nabx", "#c2410c")];

fn paint(nodes: &mut [Node], walk: &Walk, color: &'static str, off: f64) {
    for &(v, k) in &walk.path {
        nodes[v].mark = Some((k, color, off));
    }
    if let Some((v, k, c)) = walk.fail {
        nodes[v].fail = Some((k, c as char, color));
    }
}

fn main() {
    fs::create_dir_all("t3").unwrap();
    let n = TEXT.len();
    let t = trie(TEXT);
    let s = tree(&t);
    let names = internal_names(&s);
    let trie_nodes = t.children.len();
    let tree_nodes = s.children.len();
    let tree_internal = (0..tree_nodes).filter(|&v| s.leaf[v].is_none()).count();
    let tree_leaves = tree_nodes - tree_internal;
    let mut distinct: Vec<&[u8]> = (0..n).flat_map(|i| (i + 1..=n).map(move |j| &TEXT[i..j])).collect();
    distinct.sort();
    distinct.dedup();
    assert_eq!(trie_nodes, distinct.len() + 1);
    assert_eq!(tree_leaves, n);
    let trie_branching = (0..trie_nodes).filter(|&v| t.children[v].len() >= 2).count();

    let mut report = vec![
        format!("text {} (n = {n}, zero-based positions, intervals are half-open [start, end))", String::from_utf8_lossy(TEXT)),
        format!("suffix trie: {trie_nodes} nodes, {} edges, {} leaves, {} branching nodes, deepest node depth {}", trie_nodes - 1, n, trie_branching,
                t.depth.iter().max().unwrap()),
        format!("  check: nodes = distinct nonempty substrings ({}) + root", distinct.len()),
        format!("suffix tree: {tree_nodes} nodes ({} internal including the root, {tree_leaves} leaves), {} edges", tree_internal, tree_nodes - 1),
        String::new(),
        "suffix tree edges (child: interval -> label)".to_string(),
    ];
    for v in 1..tree_nodes {
        let (a, b) = s.interval[v];
        let parent = (0..tree_nodes).find(|&p| s.children[p].contains(&v)).unwrap();
        report.push(format!("  {:>7} -> {:<7} [{a:>2},{b:>2})  {}", names[parent], names[v], String::from_utf8_lossy(&TEXT[a..b])));
    }

    let mut trie_draw: Vec<Node> = (0..trie_nodes)
        .map(|v| Node {
            children: t.children[v].iter().map(|&(_, c)| c).collect(),
            depth: t.depth[v],
            label: if v == 0 { Vec::new() } else { vec![TEXT[t.start[v] + t.depth[v] - 1]] },
            interval: None,
            leaf: t.leaf[v],
            name: if v == 0 { Some("root".into()) } else { None },
            mark: None,
            fail: None,
            locus: None,
            highlight: None,
        })
        .collect();
    let mut tree_draw: Vec<Node> = (0..tree_nodes)
        .map(|v| Node {
            children: s.children[v].clone(),
            depth: s.depth[v],
            label: TEXT[s.interval[v].0..s.interval[v].1].to_vec(),
            interval: if v == 0 { None } else { Some(s.interval[v]) },
            leaf: s.leaf[v],
            name: Some(if v == 0 { "root".into() } else { names[v].clone() }),
            mark: None,
            fail: None,
            locus: None,
            highlight: None,
        })
        .collect();

    let mut traces = Vec::new();
    for (index, (pattern, color)) in PATTERNS.into_iter().enumerate() {
        let off = 3.0 * index as f64 - 3.0;
        let p = pattern.as_bytes();
        let expected = reference(p, &TEXT[..n - 1]);
        let tw = trie_walk(&t, p);
        let sw = tree_walk(&s, TEXT, p);
        let trie_found = tw.locus.map(|v| leaves(v, &t.leaf, |u| t.children[u].iter().map(|&(_, c)| c).collect())).unwrap_or_default();
        let tree_found = sw.locus.map(|v| leaves(v, &s.leaf, |u| s.children[u].clone())).unwrap_or_default();
        assert_eq!(trie_found, expected);
        assert_eq!(tree_found, expected);
        paint(&mut trie_draw, &tw, color, off);
        paint(&mut tree_draw, &sw, color, off);
        report.push(String::new());
        report.push(format!("pattern {pattern}: occurrences {expected:?}"));
        report.push("  trie:".to_string());
        report.extend(tw.steps.iter().map(|x| format!("    {x}")));
        report.push(format!("    {} character steps", tw.comparisons));
        report.push("  tree:".to_string());
        report.extend(sw.steps.iter().map(|x| format!("    {x}")));
        report.push(format!("    {} character comparisons on edges; leaves below the locus: {tree_found:?}", sw.comparisons));
        traces.push(json!({"pattern": pattern, "occurrences": expected, "trie_steps": tw.steps, "tree_steps": sw.steps, "tree_comparisons": sw.comparisons}));
    }

    let legend: Vec<(&str, &str)> = PATTERNS.to_vec();
    let trie_notes = vec![
        format!("Text {}. Every edge carries one character; dots are nodes, squares are leaves", String::from_utf8_lossy(TEXT)),
        format!("labelled with the start position of their suffix. {trie_nodes} nodes, {} edges, {n} leaves.", trie_nodes - 1),
        "Coloured: search paths; ✗c marks where the next character c is missing.".to_string(),
    ];
    let tree_notes = vec![
        format!("Text {}. Unary chains of the trie are merged into one edge;", String::from_utf8_lossy(TEXT)),
        "each edge is stored as a half-open interval [start, end) of the text (grey, under the edge).".to_string(),
        format!("v1..v{}: internal nodes, squares: leaves with suffix start. {tree_nodes} nodes, {} edges.", tree_internal - 1, tree_nodes - 1),
        "Coloured: search paths; ✗c marks the mismatching character c.".to_string(),
    ];
    fs::write("t3/T3_trie.svg", svg(&trie_draw, "Suffix trie", &trie_notes, &legend)).unwrap();
    fs::write("t3/T3_tree.svg", svg(&tree_draw, "Suffix tree", &tree_notes, &legend)).unwrap();
    let text = report.join("\n");
    println!("{text}");
    fs::write("t3/T3.txt", &text).unwrap();
    fs::write("t3/T3.json", serde_json::to_string_pretty(&json!({
        "text": String::from_utf8_lossy(TEXT), "trie_nodes": trie_nodes, "trie_edges": trie_nodes - 1,
        "tree_nodes": tree_nodes, "tree_internal": tree_internal, "tree_leaves": tree_leaves, "tree_edges": tree_nodes - 1,
        "traces": traces,
    })).unwrap()).unwrap();
}
