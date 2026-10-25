pub mod draw;

use std::collections::VecDeque;
use std::fs;

use serde_json::Value;

#[derive(Clone)]
pub struct Graph {
    pub name: String,
    pub labels: Vec<String>,
    pub pos: Vec<(f64, f64)>,
    pub group: Vec<i64>,
    pub edges: Vec<(usize, usize, f64)>,
}

impl Graph {
    pub fn n(&self) -> usize {
        self.labels.len()
    }

    pub fn load(path: &str, name: &str) -> Graph {
        let data: Value = serde_json::from_str(&fs::read_to_string(path).expect("cannot read graph JSON")).unwrap();
        let g = &data["graphs"][name];
        let nodes = g["nodes"].as_array().expect("graph not found");
        let index = |id: &Value| nodes.iter().position(|n| &n["id"] == id).expect("unknown node");
        let labels = nodes.iter().map(|n| n["label"].as_str().map(String::from).unwrap_or_else(|| n["id"].to_string())).collect();
        let pos = nodes.iter().map(|n| (n["pos"][0].as_f64().unwrap_or(0.0), n["pos"][1].as_f64().unwrap_or(0.0))).collect();
        let group = nodes.iter().map(|n| n["group"].as_i64().unwrap_or(0)).collect();
        let edges = g["edges"].as_array().unwrap().iter().map(|e| {
            let w = e.get("weight").or_else(|| e.get("capacity")).and_then(Value::as_f64).unwrap_or(1.0);
            (index(&e["source"]), index(&e["target"]), w)
        }).collect();
        Graph { name: name.to_string(), labels, pos, group, edges }
    }

    pub fn from_edges(n: usize, edges: &[(usize, usize)]) -> Graph {
        Graph {
            name: String::new(),
            labels: (0..n).map(|i| i.to_string()).collect(),
            pos: vec![(0.0, 0.0); n],
            group: vec![0; n],
            edges: edges.iter().map(|&(u, v)| (u, v, 1.0)).collect(),
        }
    }

    pub fn adjacency(&self) -> Vec<Vec<i64>> {
        let mut a = vec![vec![0i64; self.n()]; self.n()];
        for &(u, v, _) in &self.edges {
            a[u][v] = 1;
        }
        a
    }

    pub fn successors(&self) -> Vec<Vec<usize>> {
        let mut s = vec![Vec::new(); self.n()];
        for &(u, v, _) in &self.edges {
            s[u].push(v);
        }
        s.iter_mut().for_each(|l| l.sort_unstable());
        s
    }
}

pub fn int_product(a: &[Vec<i64>], b: &[Vec<i64>]) -> Vec<Vec<i64>> {
    let n = a.len();
    let mut c = vec![vec![0i64; n]; n];
    for i in 0..n {
        for k in 0..n {
            if a[i][k] != 0 {
                for j in 0..n {
                    c[i][j] += a[i][k] * b[k][j];
                }
            }
        }
    }
    c
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct BitMatrix {
    pub n: usize,
    words: usize,
    rows: Vec<u64>,
}

impl BitMatrix {
    pub fn new(n: usize) -> BitMatrix {
        let words = n.div_ceil(64);
        BitMatrix { n, words, rows: vec![0; n * words] }
    }

    pub fn identity(n: usize) -> BitMatrix {
        let mut m = BitMatrix::new(n);
        (0..n).for_each(|i| m.set(i, i));
        m
    }

    pub fn reflexive_adjacency(g: &Graph) -> BitMatrix {
        let mut m = BitMatrix::identity(g.n());
        for &(u, v, _) in &g.edges {
            m.set(u, v);
        }
        m
    }

    pub fn get(&self, i: usize, j: usize) -> bool {
        self.rows[i * self.words + j / 64] >> (j % 64) & 1 == 1
    }

    pub fn set(&mut self, i: usize, j: usize) {
        self.rows[i * self.words + j / 64] |= 1 << (j % 64);
    }

    fn row(&self, i: usize) -> &[u64] {
        &self.rows[i * self.words..(i + 1) * self.words]
    }

    pub fn ones(&self) -> usize {
        self.rows.iter().map(|w| w.count_ones() as usize).sum()
    }

    pub fn to_vec(&self) -> Vec<Vec<bool>> {
        (0..self.n).map(|i| (0..self.n).map(|j| self.get(i, j)).collect()).collect()
    }

    pub fn from_vec(v: &[Vec<bool>]) -> BitMatrix {
        let mut m = BitMatrix::new(v.len());
        for (i, row) in v.iter().enumerate() {
            for (j, &x) in row.iter().enumerate() {
                if x {
                    m.set(i, j);
                }
            }
        }
        m
    }

    pub fn boolean_product(&self, other: &BitMatrix) -> BitMatrix {
        let mut c = BitMatrix::new(self.n);
        let w = self.words;
        for i in 0..self.n {
            let out = &mut c.rows[i * w..(i + 1) * w];
            for k in 0..self.n {
                if self.get(i, k) {
                    for (x, y) in out.iter_mut().zip(other.row(k)) {
                        *x |= y;
                    }
                }
            }
        }
        c
    }
}

pub fn warshall_bits(g: &Graph) -> BitMatrix {
    let mut r = BitMatrix::reflexive_adjacency(g);
    let (n, w) = (r.n, r.words);
    for k in 0..n {
        let row_k = r.row(k).to_vec();
        for i in 0..n {
            if r.get(i, k) {
                for (x, y) in r.rows[i * w..(i + 1) * w].iter_mut().zip(&row_k) {
                    *x |= y;
                }
            }
        }
    }
    r
}

pub fn warshall_scalar(g: &Graph) -> Vec<Vec<bool>> {
    let n = g.n();
    let mut r = vec![vec![false; n]; n];
    for i in 0..n {
        r[i][i] = true;
    }
    for &(u, v, _) in &g.edges {
        r[u][v] = true;
    }
    for k in 0..n {
        for i in 0..n {
            if r[i][k] {
                for j in 0..n {
                    if r[k][j] {
                        r[i][j] = true;
                    }
                }
            }
        }
    }
    r
}

pub fn squaring_bits(g: &Graph) -> (BitMatrix, usize) {
    let mut r = BitMatrix::reflexive_adjacency(g);
    let mut squarings = 0;
    loop {
        let next = r.boolean_product(&r);
        squarings += 1;
        if next == r {
            return (r, squarings);
        }
        r = next;
    }
}

pub fn squaring_scalar(g: &Graph) -> (Vec<Vec<bool>>, usize) {
    let n = g.n();
    let mut r = vec![vec![false; n]; n];
    for i in 0..n {
        r[i][i] = true;
    }
    for &(u, v, _) in &g.edges {
        r[u][v] = true;
    }
    let mut squarings = 0;
    loop {
        let mut next = vec![vec![false; n]; n];
        for i in 0..n {
            for j in 0..n {
                let mut any = false;
                for k in 0..n {
                    if r[i][k] && r[k][j] {
                        any = true;
                        break;
                    }
                }
                next[i][j] = any;
            }
        }
        squarings += 1;
        if next == r {
            return (r, squarings);
        }
        r = next;
    }
}

pub fn bfs_closure(g: &Graph) -> Vec<Vec<bool>> {
    let succ = g.successors();
    (0..g.n()).map(|s| {
        let mut seen = vec![false; g.n()];
        seen[s] = true;
        let mut queue = VecDeque::from([s]);
        while let Some(u) = queue.pop_front() {
            for &v in &succ[u] {
                if !seen[v] {
                    seen[v] = true;
                    queue.push_back(v);
                }
            }
        }
        seen
    }).collect()
}

pub fn scc_groups(r: &[Vec<bool>]) -> Vec<Vec<usize>> {
    let n = r.len();
    let mut assigned = vec![false; n];
    let mut groups = Vec::new();
    for i in 0..n {
        if !assigned[i] {
            let group: Vec<usize> = (0..n).filter(|&j| r[i][j] && r[j][i]).collect();
            group.iter().for_each(|&j| assigned[j] = true);
            groups.push(group);
        }
    }
    groups
}

pub struct SplitMix64(pub u64);

impl SplitMix64 {
    pub fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }

    pub fn uniform(&mut self) -> f64 {
        (self.next() >> 11) as f64 / (1u64 << 53) as f64
    }
}

pub fn transition(g: &Graph, weighted: bool) -> Vec<Vec<f64>> {
    let n = g.n();
    let mut p = vec![vec![0.0; n]; n];
    for &(u, v, w) in &g.edges {
        p[u][v] += if weighted { w } else { 1.0 };
    }
    for row in p.iter_mut() {
        let total: f64 = row.iter().sum();
        if total == 0.0 {
            row.iter_mut().for_each(|x| *x = 1.0 / n as f64);
        } else {
            row.iter_mut().for_each(|x| *x /= total);
        }
    }
    p
}

pub fn vector_step(p: &[f64], m: &[Vec<f64>]) -> Vec<f64> {
    let mut out = vec![0.0; p.len()];
    for (i, &pi) in p.iter().enumerate() {
        if pi != 0.0 {
            for (o, &mij) in out.iter_mut().zip(&m[i]) {
                *o += pi * mij;
            }
        }
    }
    out
}

pub struct Sampler {
    rows: Vec<Vec<(usize, f64)>>,
}

impl Sampler {
    pub fn new(p: &[Vec<f64>]) -> Sampler {
        let rows = p.iter().map(|row| {
            let mut acc = 0.0;
            let mut r: Vec<(usize, f64)> = row.iter().enumerate().filter(|&(_, &x)| x > 0.0).map(|(j, &x)| { acc += x; (j, acc) }).collect();
            if let Some(last) = r.last_mut() {
                last.1 = 1.0;
            }
            r
        }).collect();
        Sampler { rows }
    }

    pub fn next(&self, u: usize, rng: &mut SplitMix64) -> usize {
        let x = rng.uniform();
        let row = &self.rows[u];
        row.iter().find(|&&(_, c)| x < c).map(|&(j, _)| j).unwrap_or(row[row.len() - 1].0)
    }

    pub fn endpoints(&self, start: usize, steps: usize, walkers: usize, rng: &mut SplitMix64) -> Vec<usize> {
        let mut counts = vec![0; self.rows.len()];
        for _ in 0..walkers {
            let mut u = start;
            for _ in 0..steps {
                u = self.next(u, rng);
            }
            counts[u] += 1;
        }
        counts
    }
}

pub fn l1(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b).map(|(x, y)| (x - y).abs()).sum()
}

pub struct PageRank {
    pub vector: Vec<f64>,
    pub iterations: usize,
    pub converged: bool,
    pub diffs: Vec<f64>,
    pub history: Vec<Vec<f64>>,
}

pub fn teleport_step(p: &[f64], m: &[Vec<f64>], rho: f64) -> Vec<f64> {
    let n = p.len() as f64;
    vector_step(p, m).iter().map(|&x| (1.0 - rho) * x + rho / n).collect()
}

pub fn pagerank(m: &[Vec<f64>], rho: f64, start: &[f64], tol: f64, max_iter: usize, keep: usize) -> PageRank {
    let mut p = start.to_vec();
    let mut diffs = Vec::new();
    let mut history = vec![p.clone()];
    for k in 1..=max_iter {
        let q = teleport_step(&p, m, rho);
        let d = l1(&p, &q);
        diffs.push(d);
        p = q;
        if history.len() < keep {
            history.push(p.clone());
        }
        if d < tol {
            return PageRank { vector: p, iterations: k, converged: true, diffs, history };
        }
    }
    PageRank { vector: p, iterations: max_iter, converged: false, diffs, history }
}

pub fn long_walk(sampler: &Sampler, n: usize, rho: f64, start: usize, burn: usize, count: usize, rng: &mut SplitMix64) -> Vec<usize> {
    let mut visits = vec![0; n];
    let mut u = start;
    for k in 0..burn + count {
        u = if rng.uniform() < rho { ((rng.uniform() * n as f64) as usize).min(n - 1) } else { sampler.next(u, rng) };
        if k >= burn {
            visits[u] += 1;
        }
    }
    visits
}

pub fn top_k(v: &[f64], k: usize) -> Vec<usize> {
    let mut idx: Vec<usize> = (0..v.len()).collect();
    idx.sort_by(|&a, &b| v[b].total_cmp(&v[a]).then(a.cmp(&b)));
    idx.truncate(k);
    idx
}

pub struct Arc {
    pub to: usize,
    pub residual: f64,
    pub rev: usize,
    pub original: bool,
}

pub struct FlowNet {
    pub adj: Vec<Vec<Arc>>,
    pub edges: Vec<(usize, usize, f64, usize)>,
}

impl FlowNet {
    pub fn new(g: &Graph) -> FlowNet {
        let mut adj: Vec<Vec<Arc>> = (0..g.n()).map(|_| Vec::new()).collect();
        let mut edges = Vec::new();
        for &(u, v, c) in &g.edges {
            let (iu, iv) = (adj[u].len(), adj[v].len());
            adj[u].push(Arc { to: v, residual: c, rev: iv, original: true });
            adj[v].push(Arc { to: u, residual: 0.0, rev: iu, original: false });
            edges.push((u, v, c, iu));
        }
        FlowNet { adj, edges }
    }

    pub fn flow(&self, e: usize) -> f64 {
        let (u, _, _, i) = self.edges[e];
        let a = &self.adj[u][i];
        self.adj[a.to][a.rev].residual
    }

    pub fn residual_edges(&self) -> Vec<(usize, usize, f64, bool)> {
        let mut out = Vec::new();
        for (u, arcs) in self.adj.iter().enumerate() {
            for a in arcs {
                if a.residual > 0.0 {
                    out.push((u, a.to, a.residual, a.original));
                }
            }
        }
        out
    }

    pub fn augment_path(&mut self, path: &[usize]) -> f64 {
        let mut picks = Vec::new();
        for w in path.windows(2) {
            let i = self.adj[w[0]].iter().position(|a| a.to == w[1] && a.residual > 0.0).expect("no residual arc on path");
            picks.push((w[0], i));
        }
        let bottleneck = picks.iter().map(|&(u, i)| self.adj[u][i].residual).fold(f64::INFINITY, f64::min);
        for (u, i) in picks {
            self.adj[u][i].residual -= bottleneck;
            let (to, rev) = (self.adj[u][i].to, self.adj[u][i].rev);
            self.adj[to][rev].residual += bottleneck;
        }
        bottleneck
    }

    pub fn reachable(&self, s: usize) -> Vec<bool> {
        let mut seen = vec![false; self.adj.len()];
        seen[s] = true;
        let mut queue = VecDeque::from([s]);
        while let Some(u) = queue.pop_front() {
            for a in &self.adj[u] {
                if a.residual > 0.0 && !seen[a.to] {
                    seen[a.to] = true;
                    queue.push_back(a.to);
                }
            }
        }
        seen
    }
}

pub struct MaxFlow {
    pub value: f64,
    pub augmentations: usize,
    pub examinations: usize,
    pub path_lengths: Vec<usize>,
    pub first_paths: Vec<Vec<usize>>,
}

impl FlowNet {
    pub fn bfs_path(&self, s: usize, t: usize, examinations: &mut usize) -> Option<Vec<(usize, usize)>> {
        let n = self.adj.len();
        let mut parent: Vec<Option<(usize, usize)>> = vec![None; n];
        let mut seen = vec![false; n];
        seen[s] = true;
        let mut queue = VecDeque::from([s]);
        while let Some(u) = queue.pop_front() {
            for (i, a) in self.adj[u].iter().enumerate() {
                *examinations += 1;
                if a.residual > 0.0 && !seen[a.to] {
                    seen[a.to] = true;
                    parent[a.to] = Some((u, i));
                    if a.to == t {
                        let mut path = Vec::new();
                        let mut v = t;
                        while let Some((p, i)) = parent[v] {
                            path.push((p, i));
                            v = p;
                        }
                        path.reverse();
                        return Some(path);
                    }
                    queue.push_back(a.to);
                }
            }
        }
        None
    }

    pub fn edmonds_karp(&mut self, s: usize, t: usize, keep: usize) -> MaxFlow {
        let mut result = MaxFlow { value: 0.0, augmentations: 0, examinations: 0, path_lengths: Vec::new(), first_paths: Vec::new() };
        while let Some(path) = self.bfs_path(s, t, &mut result.examinations) {
            let bottleneck = path.iter().map(|&(u, i)| self.adj[u][i].residual).fold(f64::INFINITY, f64::min);
            for &(u, i) in &path {
                self.adj[u][i].residual -= bottleneck;
                let (to, rev) = (self.adj[u][i].to, self.adj[u][i].rev);
                self.adj[to][rev].residual += bottleneck;
            }
            result.value += bottleneck;
            result.augmentations += 1;
            result.path_lengths.push(path.len());
            if result.first_paths.len() < keep {
                let mut nodes = vec![s];
                nodes.extend(path.iter().map(|&(u, i)| self.adj[u][i].to));
                result.first_paths.push(nodes);
            }
        }
        result
    }
}
