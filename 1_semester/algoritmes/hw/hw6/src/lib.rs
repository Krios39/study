use std::cmp::Reverse;
use std::collections::{BinaryHeap, VecDeque};
use std::fs;

use serde_json::{Value, json};

pub type Grid = Vec<Vec<u64>>;
pub type Cell = (usize, usize);

pub struct Terrain {
    pub a: Grid,
    pub b: Grid,
    pub queries: Vec<(Cell, Cell)>,
}

fn cell(v: &Value) -> Cell {
    (v[0].as_u64().unwrap() as usize, v[1].as_u64().unwrap() as usize)
}

fn grid(v: &Value) -> Grid {
    v.as_array().unwrap().iter()
        .map(|row| row.as_array().unwrap().iter().map(|x| x.as_u64().unwrap()).collect())
        .collect()
}

pub fn load_terrain(path: &str) -> Terrain {
    let text = fs::read_to_string(path).expect("cannot read terrain JSON");
    let data: Value = serde_json::from_str(&text).expect("bad terrain JSON");
    Terrain {
        a: grid(&data["maps"]["A"]),
        b: grid(&data["maps"]["B"]),
        queries: data["queries"].as_array().unwrap().iter().map(|q| (cell(&q[0]), cell(&q[1]))).collect(),
    }
}

pub fn neighbours(g: &Grid, (r, c): Cell) -> Vec<(Cell, u64)> {
    let (rows, cols) = (g.len() as isize, g[0].len() as isize);
    let mut out = Vec::with_capacity(4);
    for (dr, dc) in [(-1, 0), (0, -1), (0, 1), (1, 0)] {
        let (rr, cc) = (r as isize + dr, c as isize + dc);
        if rr >= 0 && rr < rows && cc >= 0 && cc < cols && g[rr as usize][cc as usize] != 0 {
            let v = (rr as usize, cc as usize);
            out.push((v, g[r][c].max(g[v.0][v.1])));
        }
    }
    out
}

pub fn path_cost(g: &Grid, path: &[Cell]) -> u64 {
    path.windows(2)
        .map(|w| neighbours(g, w[0]).into_iter().find(|(v, _)| *v == w[1]).expect("not an edge").1)
        .sum()
}

fn reconstruct(parent: &[Vec<Option<Cell>>], s: Cell, t: Cell) -> Vec<Cell> {
    let mut path = vec![t];
    while *path.last().unwrap() != s {
        let (r, c) = *path.last().unwrap();
        path.push(parent[r][c].unwrap());
    }
    path.reverse();
    path
}

pub fn bfs(g: &Grid, s: Cell, t: Cell) -> (Vec<Cell>, usize) {
    let mut parent = vec![vec![None; g[0].len()]; g.len()];
    let mut seen = vec![vec![false; g[0].len()]; g.len()];
    let mut queue = VecDeque::from([s]);
    seen[s.0][s.1] = true;
    let mut discovered = 1;
    while let Some(u) = queue.pop_front() {
        for (v, _) in neighbours(g, u) {
            if seen[v.0][v.1] {
                continue;
            }
            seen[v.0][v.1] = true;
            parent[v.0][v.1] = Some(u);
            discovered += 1;
            if v == t {
                return (reconstruct(&parent, s, t), discovered);
            }
            queue.push_back(v);
        }
    }
    panic!("target unreachable");
}

pub fn bfs_table(g: &Grid, t: Cell) -> (Vec<Vec<Option<u64>>>, usize) {
    let mut dist = vec![vec![None; g[0].len()]; g.len()];
    let mut queue = VecDeque::from([t]);
    dist[t.0][t.1] = Some(0);
    let mut visited = 0;
    while let Some(u) = queue.pop_front() {
        visited += 1;
        let d = dist[u.0][u.1].unwrap();
        for (v, _) in neighbours(g, u) {
            if dist[v.0][v.1].is_none() {
                dist[v.0][v.1] = Some(d + 1);
                queue.push_back(v);
            }
        }
    }
    (dist, visited)
}

pub struct SearchResult {
    pub path: Vec<Cell>,
    pub cost: u64,
    pub settled: Vec<Cell>,
}

pub fn astar(g: &Grid, s: Cell, t: Cell, h: impl Fn(Cell) -> u64) -> SearchResult {
    let (rows, cols) = (g.len(), g[0].len());
    let mut dist = vec![vec![u64::MAX; cols]; rows];
    let mut parent = vec![vec![None; cols]; rows];
    let mut done = vec![vec![false; cols]; rows];
    let mut settled = Vec::new();
    let mut heap = BinaryHeap::new();

    dist[s.0][s.1] = 0;
    heap.push(Reverse((h(s), Reverse(0u64), s.0, s.1)));

    while let Some(Reverse((_, Reverse(gu), r, c))) = heap.pop() {
        let u = (r, c);
        if done[r][c] || gu != dist[r][c] {
            continue;
        }
        done[r][c] = true;
        settled.push(u);
        if u == t {
            return SearchResult { path: reconstruct(&parent, s, t), cost: gu, settled };
        }
        for (v, w) in neighbours(g, u) {
            let ng = gu + w;
            if !done[v.0][v.1] && ng < dist[v.0][v.1] {
                dist[v.0][v.1] = ng;
                parent[v.0][v.1] = Some(u);
                heap.push(Reverse((ng + h(v), Reverse(ng), v.0, v.1)));
            }
        }
    }
    panic!("target unreachable");
}

pub fn manhattan(t: Cell) -> impl Fn(Cell) -> u64 {
    move |(r, c)| (r.abs_diff(t.0) + c.abs_diff(t.1)) as u64
}

pub fn cells_json(cells: &[Cell]) -> Value {
    json!(cells.iter().map(|&(r, c)| [r, c]).collect::<Vec<_>>())
}
