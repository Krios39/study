use rand::rngs::StdRng;
use rand::SeedableRng;
use rand_distr::{Distribution, Normal};
use std::time::Instant;

pub fn stream_a(n: usize, keep: usize, seed: u64) -> Vec<i64> {
    let mut rng = StdRng::seed_from_u64(seed);
    let spread = 50.0 * (keep as f64);
    let normal = Normal::new(0.0, spread).unwrap();
    (0..n).map(|_| normal.sample(&mut rng).round() as i64).collect()
}

pub fn stream_b(n: usize, keep: usize, seed: u64) -> Vec<i64> {
    let mut rng = StdRng::seed_from_u64(seed);
    let spread = 50.0 * (keep as f64);
    let normal = Normal::new(0.0, spread).unwrap();
    let mut level = 0.0;
    (0..n).map(|_| {
        level += 20.0;
        (level + normal.sample(&mut rng)).round() as i64
    }).collect()
}

pub fn stream_c(n: usize, keep: usize, seed: u64) -> Vec<i64> {
    let mut rng = StdRng::seed_from_u64(seed);
    let spread = 50.0 * (keep as f64);
    let normal = Normal::new(0.0, spread).unwrap();
    let velocity_noise = Normal::new(0.0, 12.0).unwrap();
    let mut level = 0.0;
    let mut velocity = 20.0;
    (0..n).map(|i| {
        if i > 0 && i % 4096 == 0 {
            velocity = 0.85 * velocity + 0.15 * 20.0 + velocity_noise.sample(&mut rng);
        }
        level += velocity;
        (level + normal.sample(&mut rng)).round() as i64
    }).collect()
}

// ---------------------------------------------------------
// Структуры для статистики и K-арной кучи
// ---------------------------------------------------------
#[derive(Default, Clone)]
struct Stats {
    root_comparisons: usize,
    accepted_replacements: usize,
    child_comparisons: usize,
    moved_items: usize,
}

struct KaryHeap {
    data: Vec<i64>,
    k: usize,
}

impl KaryHeap {
    fn new(initial_data: &[i64], k: usize, stats: &mut Stats) -> Self {
        let mut heap = KaryHeap {
            data: initial_data.to_vec(),
            k,
        };
        heap.heapify(stats);
        heap
    }

    fn heapify(&mut self, stats: &mut Stats) {
        let n = self.data.len();
        if n <= 1 { return; }
        let last_parent = (n - 2) / self.k;
        for i in (0..=last_parent).rev() {
            self.sift_down(i, stats);
        }
    }

    fn sift_down(&mut self, mut i: usize, stats: &mut Stats) {
        let m = self.data.len();
        loop {
            let first_child = self.k * i + 1;
            if first_child >= m { break; }

            let last_child = std::cmp::min(self.k * i + self.k, m - 1);
            let mut min_child = first_child;

            for c in (first_child + 1)..=last_child {
                stats.child_comparisons += 1;
                if self.data[c] < self.data[min_child] {
                    min_child = c;
                }
            }

            if self.data[i] <= self.data[min_child] {
                break;
            }

            self.data.swap(i, min_child);
            stats.moved_items += 1;
            i = min_child;
        }
    }

    fn is_valid_heap(&self) -> bool {
        let m = self.data.len();
        for i in 0..m {
            let first_child = self.k * i + 1;
            let last_child = std::cmp::min(self.k * i + self.k, m - 1);
            for c in first_child..=last_child {
                if self.data[i] > self.data[c] {
                    return false;
                }
            }
        }
        true
    }
}

// ---------------------------------------------------------
// Запуск эксперимента
// ---------------------------------------------------------
fn run_experiment(stream: &[i64], stream_name: &str, m: usize, n: usize, k_values: &[usize]) {
    let block_size = 10_000;

    let mut sorted_stream = stream.to_vec();
    sorted_stream.sort_unstable();
    let ground_truth = sorted_stream[n - m..].to_vec();

    println!("\nStream: {}, m = {}", stream_name, m);
    println!("{:<4} | {:<12} | {:<12} | {:<12} | {:<12} | {:<10}",
             "k", "Root Comps", "Accepted", "Child Comps", "Moved", "Time (ms)");
    println!("{:-<71}", "");

    let mut chart_js_blocks: Vec<usize> = Vec::new();

    for (index, &k) in k_values.iter().enumerate() {
        let mut stats = Stats::default();
        let mut blocks = vec![0; n / block_size];

        let initial_data = &stream[0..m];

        let start = Instant::now();
        let mut heap = KaryHeap::new(initial_data, k, &mut stats);

        for (idx_offset, &x) in stream[m..].iter().enumerate() {
            let current_idx = m + idx_offset;
            stats.root_comparisons += 1;

            if x > heap.data[0] {
                stats.accepted_replacements += 1;
                blocks[current_idx / block_size] += 1;

                heap.data[0] = x;
                heap.sift_down(0, &mut stats);

                if stats.accepted_replacements <= 100 {
                    assert!(heap.is_valid_heap(), "Heap invariant violated during early replacements!");
                }
            }
        }

        let elapsed = start.elapsed().as_millis();

        assert!(heap.is_valid_heap(), "Heap invariant violated at the end!");

        let mut final_data = heap.data.clone();
        final_data.sort_unstable();
        assert_eq!(final_data, ground_truth, "Correctness failed! k={} output doesn't match sorted truth.", k);

        // Сохраняем массив блоков только для первого k (они идентичны для всех k)
        if index == 0 {
            chart_js_blocks = blocks.clone();
        }

        println!("{:<4} | {:<12} | {:<12} | {:<12} | {:<12} | {:<10}",
                 k, stats.root_comparisons, stats.accepted_replacements, stats.child_comparisons, stats.moved_items, elapsed);
    }

    if m == 10_000 {
        println!("{:-<71}", "");
        println!("Chart.js data array for {}:", stream_name);
        println!("{:?}", chart_js_blocks);
    }
}

fn main() {
    let n = 1_000_000;
    let m_values = [100, 10_000];
    let k_values = [2, 3, 4, 8, 16];
    let seed = 2026;

    let stream_a_data = stream_a(n, m_values[1], seed);
    let stream_b_data = stream_b(n, m_values[1], seed);
    let stream_c_data = stream_c(n, m_values[1], seed);

    for &m in &m_values {
        run_experiment(&stream_a_data, "Stream A", m, n, &k_values);
        run_experiment(&stream_b_data, "Stream B", m, n, &k_values);
        run_experiment(&stream_c_data, "Stream C", m, n, &k_values);
    }

    for &test_seed in &[2027, 2028] {
        println!("Seed: {}", test_seed);
        let stream = stream_b(n, 10_000, test_seed);
        run_experiment(&stream, "Stream B (Stability)", 10_000, n, &[4, 8]);
    }
}