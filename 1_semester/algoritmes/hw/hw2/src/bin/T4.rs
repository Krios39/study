use rand::rngs::StdRng;
use rand::{RngExt, SeedableRng};
use std::hint::black_box;
use std::time::Instant;

#[derive(Default)]
struct QuickSort {
    comparisons: usize,
    max_depth: usize,
}

impl QuickSort {
    fn new() -> Self {
        Self::default()
    }

    fn sort(&mut self, arr: &mut [usize], rng: &mut StdRng) {
        self.sort_rec(arr, 1, rng);
    }

    fn sort_rec(&mut self, arr: &mut [usize], depth: usize, rng: &mut StdRng) {
        self.max_depth = self.max_depth.max(depth);

        if arr.len() <= 1 {
            return;
        }

        fn swap(arr: &mut [usize], i: usize, j: usize) {
            let tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }

        if arr.len() == 2 {
            self.comparisons += 1;
            if arr[0] > arr[1] {
                swap(arr, 0, 1);
            }
            return;
        }

        let n = arr.len();
        let i = rng.random_range(0..n);
        let offset = 1 + rng.random_range(0..n - 1);
        let j = (i + offset) % n;

        swap(arr, 0, i);
        let actual_j = if j == 0 { i } else { j };
        swap(arr, n - 1, actual_j);

        self.comparisons += 1;
        let mut l_pivot = arr[0];
        let mut r_pivot = arr[arr.len() - 1];

        if l_pivot > r_pivot {
            let tmp = l_pivot;
            l_pivot = r_pivot;
            r_pivot = tmp;
            swap(arr, 0, arr.len() - 1);
        }

        let pivots_are_equal = l_pivot == r_pivot;

        let mut lt = 1;
        let mut gt = arr.len() - 2;
        let mut k = lt;

        while k <= gt {
            self.comparisons += 1;
            if arr[k] < l_pivot {
                swap(arr, lt, k);
                lt += 1;
                k += 1;
            } else {
                self.comparisons += 1;
                if arr[k] > r_pivot {
                    swap(arr, gt, k);
                    gt -= 1;
                } else {
                    k += 1;
                }
            }
        }

        let p1_idx = lt - 1;
        let p2_idx = gt + 1;
        swap(arr, 0, p1_idx);
        swap(arr, arr.len() - 1, p2_idx);

        let (left, rest) = arr.split_at_mut(p1_idx);
        let mid_len = p2_idx - p1_idx - 1;
        let (mid, right) = rest[1..].split_at_mut(mid_len);

        self.sort_rec(left, depth + 1, rng);

        if !pivots_are_equal {
            self.sort_rec(mid, depth + 1, rng);
        }

        self.sort_rec(&mut right[1..], depth + 1, rng);
    }
}

#[inline(never)]
fn linear_search(array: &[usize], searched: usize) -> (Option<usize>, usize) {
    let mut comparisons = 0;
    for (i, &val) in array.iter().enumerate() {
        comparisons += 1;
        if val == searched {
            return (Some(i), comparisons);
        }
    }
    (None, comparisons)
}

#[inline(never)]
fn lower_bound(array: &[usize], searched: usize) -> (usize, usize) {
    let mut left_border = 0;
    let mut right_border = array.len();
    let mut comparisons = 0;

    while left_border < right_border {
        let k = left_border + (right_border - left_border) / 2;
        comparisons += 1;

        if array[k] < searched {
            left_border = k + 1;
        } else {
            right_border = k;
        }
    }

    (left_border, comparisons)
}


fn run_experiment_for_seed(seed: u64, n: usize) {
    println!("\n===========================================================");
    println!("=== Running Experiment for SEED: {} (n = {}) ===", seed, n);
    println!("===========================================================");

    let mut rng = StdRng::seed_from_u64(seed);

    let mut raw_data: Vec<usize> = (0..n).map(|x| x * 2).collect();
    // Перемешиваем Fisher-Yates shuffle
    for i in (1..n).rev() {
        let j = rng.random_range(0..=i);
        raw_data.swap(i, j);
    }

    let max_test_q = 5000;
    let mut query_pool: Vec<usize> = Vec::with_capacity(max_test_q);
    for _ in 0..max_test_q {
        let coin = rng.random_bool(0.5);
        if coin {
            let idx = rng.random_range(0..n);
            query_pool.push(raw_data[idx]); // Присутствует
        } else {
            let odd_val = rng.random_range(0..n) * 2 + 1;
            query_pool.push(odd_val); // Отсутствует
        }
    }

    let mut sorted_data = raw_data.clone();
    let mut qs = QuickSort::new();
    let t_sort_start = Instant::now();
    qs.sort(&mut sorted_data, &mut rng);
    let sort_time_us = t_sort_start.elapsed().as_micros();
    let sort_comps = qs.comparisons;

    let sample_q = 200;
    let mut total_lin_comps = 0;
    let t_lin_start = Instant::now();
    for &q in &query_pool[0..sample_q] {
        let (res, comps) = linear_search(&raw_data, q);
        black_box(res);
        total_lin_comps += comps;
    }
    let avg_lin_time_ns = t_lin_start.elapsed().as_nanos() as f64 / sample_q as f64;
    let avg_lin_comps = total_lin_comps as f64 / sample_q as f64;

    let mut total_bin_comps = 0;
    let t_bin_start = Instant::now();
    for &q in &query_pool[0..sample_q] {
        let (res, comps) = lower_bound(&sorted_data, q);
        black_box(res);
        total_bin_comps += comps;
    }
    let avg_bin_time_ns = t_bin_start.elapsed().as_nanos() as f64 / sample_q as f64;
    let avg_bin_comps = total_bin_comps as f64 / sample_q as f64;

    let q_theory_naive = (n as f64 * (n as f64).log2()) / (n as f64 - (n as f64).log2());

    let q_comp_est = (sort_comps as f64 / (avg_lin_comps - avg_bin_comps)).ceil() as usize;

    let sort_time_ns = (sort_time_us as f64) * 1000.0;
    let q_time_est = (sort_time_ns / (avg_lin_time_ns - avg_bin_time_ns)).ceil() as usize;

    println!("Sort Cost: {} comparisons, {} µs", sort_comps, sort_time_us);
    println!("Avg Linear Search: {:.1} comps, {:.1} ns", avg_lin_comps, avg_lin_time_ns);
    println!("Avg Binary Search: {:.1} comps, {:.1} ns", avg_bin_comps, avg_bin_time_ns);
    println!("Theoretical Naive Crossover:   ~{:.1} queries", q_theory_naive);
    println!("Estimated Comparison Crossover: ~{} queries", q_comp_est);
    println!("Estimated Time Crossover:       ~{} queries", q_time_est);

    let test_points = [
        10,
        q_comp_est.saturating_sub(10),
        q_comp_est,
        q_comp_est + 10,
        q_time_est.saturating_sub(30),
        q_time_est,
        q_time_est + 50,
    ];

    println!("\n{:<6} | {:<16} | {:<20} | {:<15} | {:<18}",
             "q", "Strat 1 Comps", "Strat 2 Comps (Sort+Bin)", "Strat 1 Time(µs)", "Strat 2 Time(µs)");
    println!("{:-<85}", "");

    for &q in &test_points {
        let t1_start = Instant::now();
        let mut s1_comps = 0;
        for &key in &query_pool[0..q] {
            let (res, c) = linear_search(&raw_data, key);
            black_box(res);
            s1_comps += c;
        }
        let s1_time = t1_start.elapsed().as_micros();

        let mut arr_to_sort = raw_data.clone();
        let mut qs_local = QuickSort::new();
        let mut local_rng = StdRng::seed_from_u64(seed);

        let t2_start = Instant::now();
        qs_local.sort(&mut arr_to_sort, &mut local_rng);

        let mut s2_bin_comps = 0;
        for &key in &query_pool[0..q] {
            let (res, c) = lower_bound(&arr_to_sort, key);
            black_box(res);
            s2_bin_comps += c;
        }
        let s2_time = t2_start.elapsed().as_micros();
        let s2_comps = qs_local.comparisons + s2_bin_comps;

        let comp_winner = if s2_comps < s1_comps { "Strat 2" } else { "Strat 1" };
        let time_winner = if s2_time < s1_time { "Strat 2" } else { "Strat 1" };

        println!(
            "{:<6} | {:<16} | {:<20} | {:<15} | {:<18} [Comp: {}, Time: {}]",
            q, s1_comps, s2_comps, s1_time, s2_time, comp_winner, time_winner
        );
    }
}

fn main() {
    let n = 100_000;
    let seeds = [42, 2026, 777];

    for &s in &seeds {
        run_experiment_for_seed(s, n);
    }
}