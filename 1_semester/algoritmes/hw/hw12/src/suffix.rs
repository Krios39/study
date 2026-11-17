pub struct Trie {
    pub children: Vec<Vec<(u8, usize)>>,
    pub depth: Vec<usize>,
    pub start: Vec<usize>,
    pub leaf: Vec<Option<usize>>,
}

pub fn trie(text: &[u8]) -> Trie {
    let mut t = Trie { children: vec![Vec::new()], depth: vec![0], start: vec![0], leaf: vec![None] };
    for i in 0..text.len() {
        let mut v = 0;
        for &c in &text[i..] {
            v = match t.children[v].binary_search_by_key(&c, |&(x, _)| x) {
                Ok(k) => t.children[v][k].1,
                Err(k) => {
                    let id = t.children.len();
                    t.children.push(Vec::new());
                    t.depth.push(t.depth[v] + 1);
                    t.start.push(i);
                    t.leaf.push(None);
                    t.children[v].insert(k, (c, id));
                    id
                }
            };
        }
        t.leaf[v] = Some(i);
    }
    t
}

pub struct Tree {
    pub children: Vec<Vec<usize>>,
    pub interval: Vec<(usize, usize)>,
    pub depth: Vec<usize>,
    pub leaf: Vec<Option<usize>>,
}

pub fn tree(t: &Trie) -> Tree {
    let mut s = Tree { children: vec![Vec::new()], interval: vec![(0, 0)], depth: vec![0], leaf: vec![None] };
    grow(t, &mut s, 0, 0);
    s
}

fn grow(t: &Trie, s: &mut Tree, u: usize, tu: usize) {
    for &(_, first) in &t.children[tu] {
        let mut tv = first;
        while t.children[tv].len() == 1 && t.leaf[tv].is_none() {
            tv = t.children[tv][0].1;
        }
        let id = s.children.len();
        s.children.push(Vec::new());
        s.interval.push((t.start[tv] + t.depth[tu], t.start[tv] + t.depth[tv]));
        s.depth.push(t.depth[tv]);
        s.leaf.push(t.leaf[tv]);
        s.children[u].push(id);
        grow(t, s, id, tv);
    }
}

pub fn internal_names(s: &Tree) -> Vec<String> {
    let mut k = 0;
    (0..s.children.len())
        .map(|v| {
            if v == 0 {
                "root".to_string()
            } else if s.leaf[v].is_some() {
                format!("leaf {}", s.leaf[v].unwrap())
            } else {
                k += 1;
                format!("v{k}")
            }
        })
        .collect()
}

pub fn leaves(v: usize, leaf: &[Option<usize>], children: impl Fn(usize) -> Vec<usize>) -> Vec<usize> {
    let mut out = Vec::new();
    let mut stack = vec![v];
    while let Some(u) = stack.pop() {
        if let Some(p) = leaf[u] {
            out.push(p);
        }
        stack.extend(children(u));
    }
    out.sort();
    out
}

pub struct Walk {
    pub steps: Vec<String>,
    pub comparisons: usize,
    pub locus: Option<usize>,
    pub path: Vec<(usize, usize)>,
    pub fail: Option<(usize, usize, u8)>,
}

pub fn trie_walk(t: &Trie, pattern: &[u8]) -> Walk {
    let mut w = Walk { steps: Vec::new(), comparisons: 0, locus: None, path: Vec::new(), fail: None };
    let mut v = 0;
    let mut spelled = String::new();
    for &c in pattern {
        let options: String = t.children[v].iter().map(|&(x, _)| x as char).collect();
        let here = if spelled.is_empty() { "root".to_string() } else { format!("\"{spelled}\"") };
        w.comparisons += 1;
        match t.children[v].iter().find(|&&(x, _)| x == c) {
            Some(&(_, next)) => {
                spelled.push(c as char);
                w.steps.push(format!("at {here}, edges {{{options}}}: follow '{}' to \"{spelled}\"", c as char));
                w.path.push((next, 1));
                v = next;
            }
            None => {
                w.steps.push(format!("at {here}, edges {{{options}}}: no '{}', the pattern does not occur", c as char));
                w.fail = Some((v, 0, c));
                return w;
            }
        }
    }
    w.locus = Some(v);
    w
}

pub fn tree_walk(s: &Tree, text: &[u8], pattern: &[u8]) -> Walk {
    let mut w = Walk { steps: Vec::new(), comparisons: 0, locus: None, path: Vec::new(), fail: None };
    let names = internal_names(s);
    let mut v = 0;
    let mut matched = 0;
    while matched < pattern.len() {
        let c = pattern[matched];
        let firsts: String = s.children[v].iter().map(|&x| text[s.interval[x].0] as char).collect();
        let here = names[v].clone();
        let Some(&next) = s.children[v].iter().find(|&&x| text[s.interval[x].0] == c) else {
            w.steps.push(format!("at {here}, edges start with {{{firsts}}}: none starts with '{}', the pattern does not occur", c as char));
            w.fail = Some((v, 0, c));
            return w;
        };
        let (a, b) = s.interval[next];
        let label = String::from_utf8_lossy(&text[a..b]).to_string();
        let mut k = 0;
        let mut notes = Vec::new();
        while k < b - a && matched < pattern.len() {
            w.comparisons += 1;
            let (x, y) = (text[a + k], pattern[matched]);
            notes.push(format!("{}{}{}", y as char, if x == y { "=" } else { "≠" }, x as char));
            if x != y {
                w.path.push((next, k));
                w.steps.push(format!("at {here}, edge [{a},{b}) \"{label}\": {}, mismatch inside the edge, the pattern does not occur", notes.join(" ")));
                w.fail = Some((next, k, y));
                return w;
            }
            k += 1;
            matched += 1;
        }
        w.path.push((next, k));
        if k == b - a {
            w.steps.push(format!("at {here}, edge [{a},{b}) \"{label}\": {}, arrive at {}", notes.join(" "), names[next]));
        } else {
            w.steps.push(format!("at {here}, edge [{a},{b}) \"{label}\": {}, the pattern ends after {k} of {} letters, the locus lies on this edge above {}",
                notes.join(" "), b - a, names[next]));
        }
        v = next;
    }
    w.locus = Some(v);
    w
}
