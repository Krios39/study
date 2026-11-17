use std::fs;

use hw12::bwt::encode;
use hw12::draw::{svg, Node};
use hw12::sa::{interval, suffix_array};
use hw12::search::Silent;
use hw12::suffix::{internal_names, tree, tree_walk, trie, Tree};
use serde_json::json;

const TEXT: &[u8] = b"bananabananabandanas$";
const PATTERNS: [(&str, &str); 3] = [("ana", "#1d4ed8"), ("band", "#15803d"), ("nabx", "#c2410c")];

fn locus(s: &Tree, names: &[String], p: &[u8]) -> Option<(usize, usize, String)> {
    let w = tree_walk(s, TEXT, p);
    w.locus?;
    let &(v, k) = w.path.last().unwrap();
    let (a, b) = s.interval[v];
    Some((v, k, if k == b - a { format!("at {}", names[v]) } else { format!("{k} of {} letters along the edge [{a},{b}) into {}", b - a, names[v]) }))
}

fn main() {
    fs::create_dir_all("b1").unwrap();
    let n = TEXT.len();
    let sa = suffix_array(TEXT);
    let l = encode(TEXT);
    let mut count = [0usize; 256];
    for &c in &l {
        count[c as usize] += 1;
    }
    let mut first = [0usize; 256];
    let mut total = 0;
    for c in 0..256 {
        first[c] = total;
        total += count[c];
    }
    let occ = |c: u8, i: usize| l[..i].iter().filter(|&&x| x == c).count();
    let s = tree(&trie(TEXT));
    let names = internal_names(&s);

    let mut report = vec![
        format!("text {} , L = BWT = {}", String::from_utf8_lossy(TEXT), String::from_utf8_lossy(&l)),
        format!("C[c] = number of letters smaller than c: {}",
            ["$", "a", "b", "d", "n", "s"].iter().map(|c| format!("{c}:{}", first[c.as_bytes()[0] as usize])).collect::<Vec<_>>().join(" ")),
        "occ(c, i) = copies of c in L[0..i). Backward step with letter c: lo = C[c] + occ(c, lo), hi = C[c] + occ(c, hi); intervals are half-open SA rank ranges".into(),
    ];
    let mut tree_draw: Vec<Node> = (0..s.children.len())
        .map(|v| Node {
            children: s.children[v].clone(),
            depth: s.depth[v],
            label: TEXT[s.interval[v].0..s.interval[v].1].to_vec(),
            interval: if v == 0 { None } else { Some(s.interval[v]) },
            leaf: s.leaf[v],
            name: Some(names[v].clone()),
            mark: None,
            fail: None,
            locus: None,
            highlight: None,
        })
        .collect();
    let mut out = Vec::new();
    for (index, (pattern, color)) in PATTERNS.into_iter().enumerate() {
        let p = pattern.as_bytes();
        let (mut lo, mut hi) = (0usize, n);
        report.push(String::new());
        report.push(format!("pattern {pattern}: start with the whole range [0, {n})"));
        let mut steps = Vec::new();
        for j in (0..p.len()).rev() {
            let c = p[j];
            let (olo, ohi) = (occ(c, lo), occ(c, hi));
            let (nlo, nhi) = (first[c as usize] + olo, first[c as usize] + ohi);
            let suffix = &p[j..];
            let place = if nlo < nhi { locus(&s, &names, suffix).map(|x| x.2).unwrap() } else { "none".into() };
            report.push(format!("  read '{}': [{lo},{hi}) -> C[{}] + occ = {} + {olo} .. {} + {ohi} = [{nlo},{nhi})  size {}  \"{}\"  SA {:?}  locus {place}",
                c as char, c as char, first[c as usize], first[c as usize], nhi - nlo, String::from_utf8_lossy(suffix), &sa[nlo..nhi]));
            steps.push(json!({"letter": (c as char).to_string(), "suffix": String::from_utf8_lossy(suffix), "lo": nlo, "hi": nhi, "locus": place}));
            lo = nlo;
            hi = nhi;
            if lo == hi {
                report.push(format!("  the interval is empty, stop: {pattern} does not occur"));
                break;
            }
        }
        let expect = interval(TEXT, &sa, p, &mut Silent);
        if lo < hi {
            assert_eq!((lo, hi), expect);
            let mut starts: Vec<u32> = sa[lo..hi].to_vec();
            starts.sort();
            report.push(format!("  result [{lo},{hi}) = T4 binary-search interval; positions {starts:?}"));
            let w = tree_walk(&s, TEXT, p);
            for &(v, k) in &w.path {
                tree_draw[v].mark = Some((k, color, 3.0 * index as f64 - 3.0));
            }
            let (v, _, _) = locus(&s, &names, p).unwrap();
            tree_draw[v].locus = Some((format!("{pattern} = SA[{lo},{hi})"), color));
            for u in 0..tree_draw.len() {
                if s.leaf[u].is_some_and(|p| starts.contains(&(p as u32))) {
                    tree_draw[u].highlight = Some(color);
                }
            }
        } else {
            assert_eq!(expect.0, expect.1);
        }
        out.push(json!({"pattern": pattern, "lo": lo, "hi": hi, "steps": steps}));
    }
    let notes = vec![
        format!("Text {}, BWT {}. Backward search reads the pattern from right to left;", String::from_utf8_lossy(TEXT), String::from_utf8_lossy(&l)),
        "the final suffix-array interval is the set of leaves below the marked locus (diamond); those leaves are framed in the same colour.".to_string(),
        "nabx: the first letter read is x, which is not in the text, so the interval is empty at once and there is no locus.".to_string(),
    ];
    fs::write("b1/B1_loci.svg", svg(&tree_draw, "FM-index loci in the suffix tree", &notes, &PATTERNS[..2])).unwrap();
    let text = report.join("\n");
    println!("{text}");
    fs::write("b1/B1.txt", &text).unwrap();
    fs::write("b1/B1.json", serde_json::to_string_pretty(&json!({"bwt": String::from_utf8_lossy(&l), "searches": out})).unwrap()).unwrap();
}
