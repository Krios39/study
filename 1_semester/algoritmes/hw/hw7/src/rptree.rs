use std::collections::{BTreeSet, BinaryHeap};

use crate::{Image, SplitMix64, strip_count, strip_xy};

pub const LEAF_SIZE: usize = 10;

pub type Vec15 = [u8; 15];

pub fn strip_bytes(img: &Image, id: usize) -> Vec15 {
    let (x, y) = strip_xy(img, id);
    let start = 3 * (y * img.width + x);
    let mut v = [0u8; 15];
    v.copy_from_slice(&img.rgb[start..start + 15]);
    v
}

pub fn sample(img: &Image, count: usize, seed: u64) -> Vec<usize> {
    let n = strip_count(img);
    if count >= n {
        return (0..n).collect();
    }
    let mut rng = SplitMix64(seed);
    let mut chosen = BTreeSet::new();
    while chosen.len() < count {
        chosen.insert(rng.below(n as u64) as usize);
    }
    chosen.into_iter().collect()
}

pub fn project(w: &[f64; 15], v: &Vec15) -> f64 {
    (0..15).map(|k| w[k] * (v[k] as f64 / 255.0)).sum()
}

pub fn dist2(a: &Vec15, b: &Vec15) -> u32 {
    (0..15).map(|k| {
        let d = a[k] as i32 - b[k] as i32;
        (d * d) as u32
    }).sum()
}

pub enum Node {
    Leaf { items: Vec<usize>, path: String },
    Inner { w: [f64; 15], pivot_p: f64, pivot_id: usize, left_max: f64, left: usize, right: usize },
}

pub struct Tree {
    pub nodes: Vec<Node>,
    pub root: usize,
    pub vectors: Vec<Vec15>,
    pub ids: Vec<usize>,
}

fn goes_left(p: f64, id: usize, pivot_p: f64, pivot_id: usize) -> bool {
    p < pivot_p || (p == pivot_p && id < pivot_id)
}

impl Tree {
    pub fn build(vectors: Vec<Vec15>, ids: Vec<usize>, seed: u64) -> Tree {
        let mut tree = Tree { nodes: Vec::new(), root: 0, vectors, ids };
        let mut rng = SplitMix64(seed);
        let all: Vec<usize> = (0..tree.vectors.len()).collect();
        tree.root = tree.build_node(all, String::new(), &mut rng);
        tree
    }

    fn build_node(&mut self, mut items: Vec<usize>, path: String, rng: &mut SplitMix64) -> usize {
        if items.len() <= LEAF_SIZE {
            self.nodes.push(Node::Leaf { items, path });
            return self.nodes.len() - 1;
        }
        let normals = rng.normals(15);
        let norm = normals.iter().map(|x| x * x).sum::<f64>().sqrt();
        let mut w = [0.0; 15];
        for k in 0..15 {
            w[k] = normals[k] / norm;
        }
        let proj: Vec<(f64, usize, usize)> = items.iter().map(|&i| (project(&w, &self.vectors[i]), self.ids[i], i)).collect();
        let mut order = proj.clone();
        order.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap().then(a.1.cmp(&b.1)));
        let cut = items.len() / 2;
        let (pivot_p, pivot_id) = (order[cut].0, order[cut].1);
        let left_max = order[cut - 1].0;
        let left_items: Vec<usize> = order[..cut].iter().map(|t| t.2).collect();
        let right_items: Vec<usize> = order[cut..].iter().map(|t| t.2).collect();
        items.clear();
        let left = self.build_node(left_items, format!("{path}0"), rng);
        let right = self.build_node(right_items, format!("{path}1"), rng);
        self.nodes.push(Node::Inner { w, pivot_p, pivot_id, left_max, left, right });
        self.nodes.len() - 1
    }

    pub fn route(&self, v: &Vec15, id: usize) -> usize {
        let mut node = self.root;
        loop {
            match &self.nodes[node] {
                Node::Leaf { .. } => return node,
                Node::Inner { w, pivot_p, pivot_id, left, right, .. } => {
                    node = if goes_left(project(w, v), id, *pivot_p, *pivot_id) { *left } else { *right };
                }
            }
        }
    }

    pub fn depth(&self) -> usize {
        fn d(t: &Tree, n: usize) -> usize {
            match &t.nodes[n] {
                Node::Leaf { .. } => 0,
                Node::Inner { left, right, .. } => 1 + d(t, *left).max(d(t, *right)),
            }
        }
        d(self, self.root)
    }

    pub fn knn(&self, q: &Vec15, qid: usize, k: usize) -> (Vec<(u32, usize)>, usize) {
        let (out, evaluated, _) = self.knn_counted(q, qid, k);
        (out, evaluated)
    }

    pub fn knn_counted(&self, q: &Vec15, qid: usize, k: usize) -> (Vec<(u32, usize)>, usize, usize) {
        let mut heap: BinaryHeap<(u32, usize)> = BinaryHeap::new();
        let (mut evaluated, mut projections) = (0, 0);
        self.search(self.root, q, qid, k, &mut heap, &mut evaluated, &mut projections);
        let mut out = heap.into_vec();
        out.sort();
        (out, evaluated, projections)
    }

    #[allow(clippy::too_many_arguments)]
    fn search(&self, node: usize, q: &Vec15, qid: usize, k: usize, heap: &mut BinaryHeap<(u32, usize)>, evaluated: &mut usize, projections: &mut usize) {
        match &self.nodes[node] {
            Node::Leaf { items, .. } => {
                for &i in items {
                    *evaluated += 1;
                    let cand = (dist2(q, &self.vectors[i]), self.ids[i]);
                    if heap.len() < k {
                        heap.push(cand);
                    } else if cand < *heap.peek().unwrap() {
                        heap.pop();
                        heap.push(cand);
                    }
                }
            }
            Node::Inner { w, pivot_p, pivot_id, left_max, left, right } => {
                *projections += 1;
                let p = project(w, q);
                let near_left = goes_left(p, qid, *pivot_p, *pivot_id);
                let (near, far, bound) = if near_left {
                    (*left, *right, (pivot_p - p).max(0.0))
                } else {
                    (*right, *left, (p - left_max).max(0.0))
                };
                self.search(near, q, qid, k, heap, evaluated, projections);
                let bound255 = bound * 255.0;
                if heap.len() < k || bound255 * bound255 <= heap.peek().unwrap().0 as f64 + 1e-6 {
                    self.search(far, q, qid, k, heap, evaluated, projections);
                }
            }
        }
    }
}

pub fn exhaustive(vectors: &[Vec15], ids: &[usize], q: &Vec15, k: usize) -> Vec<(u32, usize)> {
    let mut all: Vec<(u32, usize)> = vectors.iter().zip(ids).map(|(v, &id)| (dist2(q, v), id)).collect();
    if k < all.len() {
        all.select_nth_unstable(k);
        all.truncate(k);
    }
    all.sort();
    all
}
