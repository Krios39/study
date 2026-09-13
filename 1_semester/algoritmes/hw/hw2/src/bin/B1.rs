
use std::time::Instant;

const MAX_DEPTH_LIMIT: usize = 1200;

pub struct ArrayGenerator;

impl ArrayGenerator {
    fn random(n: usize) -> Vec<usize> {
        (0..n).map(|_| rand::random::<u32>() as usize).collect()
    }

    fn sorted(n: usize) -> Vec<usize> {
        (0..n).collect()
    }

    fn reversed(n: usize) -> Vec<usize> {
        (0..n).rev().collect()
    }

    fn almost_sorted(n: usize) -> Vec<usize> {
        let mut arr: Vec<usize> = (0..n).collect();
        for _ in 0..(n / 100).max(1) {
            let i = (rand::random::<u32>() as usize) % n;
            let j = (rand::random::<u32>() as usize) % n;
            arr.swap(i, j);
        }
        arr
    }

    fn duplicates(n: usize) -> Vec<usize> {
        (0..n).map(|_| (rand::random::<u32>() % 5) as usize).collect()
    }

    fn sorted_blocks(n: usize) -> Vec<usize> {
        let block_count = 10;
        let block_size = n / block_count;
        let mut blocks: Vec<Vec<usize>> = (0..block_count)
            .map(|b| {
                let start = b * block_size * 2;
                (start..start + block_size).collect()
            })
            .collect();

        // Fisher-Yates shuffle блоков
        for i in (1..block_count).rev() {
            let j = (rand::random::<u32>() as usize) % (i + 1);
            blocks.swap(i, j);
        }
        blocks.into_iter().flatten().collect()
    }

    pub fn generate(name: &str, n: usize) -> Vec<usize> {
        match name {
            "Sorted" => Self::sorted(n),
            "Reverse-Sorted" => Self::reversed(n),
            "Almost-Sorted" => Self::almost_sorted(n),
            "Random" => Self::random(n),
            "Duplicates" => Self::duplicates(n),
            "Sorted-Blocks" => Self::sorted_blocks(n),
            _ => unreachable!(),
        }
    }
}


#[derive(Default)]
struct QuickSort {
    comparisons: usize,
    max_depth: usize,
    is_random: bool,
    aborted: bool,
}
impl QuickSort {
    fn new(is_random: bool) -> Self {
        Self {
            is_random,
            ..Default::default()
        }
    }

    pub fn sort_random(arr: &mut [usize]) {
        let mut qs = Self::new(true);
        qs.sort(arr);
    }

    fn sort(&mut self, arr: &mut [usize]) {
        self.sort_rec(arr, 1);
    }

    fn sort_rec(&mut self, arr: &mut [usize], depth: usize) -> bool {
        self.max_depth = self.max_depth.max(depth);

        if !self.is_random && depth >= MAX_DEPTH_LIMIT {
            self.aborted = true;
            return false;
        }

        if arr.len() <= 1 {
            return true;
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
            return true;
        }

        if self.is_random {
            let n = arr.len();
            let i = (rand::random::<u32>() as usize) % n;
            let offset = 1 + ((rand::random::<u32>() as usize) % (n - 1));
            let j = (i + offset) % n;

            swap(arr, 0, i);
            let actual_j = if j == 0 { i } else { j };
            swap(arr, n - 1, actual_j);
        }

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

        // Partition
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

        if !self.sort_rec(left, depth + 1) {
            return false;
        }

        if !pivots_are_equal && !self.sort_rec(mid, depth + 1) {
            return false;
        }

        if !self.sort_rec(&mut right[1..], depth + 1) {
            return false;
        }

        true
    }
}

// ==========================================
// 3. Run-Aware Hybrid Sort (B1)
// ==========================================
#[derive(Debug, Clone, Copy)]
pub struct Run {
    pub start: usize,
    pub len: usize,
}

pub struct RunAwareSort;

impl RunAwareSort {
    const MAX_RUNS: usize = 32;

    pub fn sort(arr: &mut [usize]) -> (usize, usize) {
        let n = arr.len();
        if n <= 1 {
            return (n, n);
        }

        match Self::detect_runs(arr, Self::MAX_RUNS) {
            Some(runs) => {
                let run_count = runs.len();
                let avg_len = n / run_count;

                if run_count > 1 {
                    Self::merge_runs(arr, runs);
                }
                (run_count, avg_len)
            }
            None => {
                QuickSort::sort_random(arr);
                (0, 0)
            }
        }
    }

    fn detect_runs(arr: &mut [usize], max_runs: usize) -> Option<Vec<Run>> {
        let n = arr.len();
        let mut runs = Vec::new();
        let mut i = 0;

        while i < n {
            if i == n - 1 {
                runs.push(Run { start: i, len: 1 });
                break;
            }

            let is_increasing = arr[i] <= arr[i + 1];
            let start = i;
            let mut len = 2;
            i += 1;

            if is_increasing {
                while i < n - 1 && arr[i] <= arr[i + 1] {
                    len += 1;
                    i += 1;
                }
            } else {
                while i < n - 1 && arr[i] > arr[i + 1] {
                    len += 1;
                    i += 1;
                }
                arr[start..start + len].reverse();
            }

            runs.push(Run { start, len });

            if runs.len() > max_runs {
                return None;
            }

            i += 1;
        }

        Some(runs)
    }

    fn merge_runs(arr: &mut [usize], mut runs: Vec<Run>) {
        let mut buffer = vec![0; arr.len()];

        while runs.len() > 1 {
            let mut next_runs = Vec::new();
            let mut idx = 0;

            while idx < runs.len() {
                if idx + 1 < runs.len() {
                    let r1 = runs[idx];
                    let r2 = runs[idx + 1];

                    Self::merge_two(
                        &arr[r1.start..r1.start + r1.len],
                        &arr[r2.start..r2.start + r2.len],
                        &mut buffer[r1.start..r2.start + r2.len],
                    );

                    arr[r1.start..r2.start + r2.len]
                        .copy_from_slice(&buffer[r1.start..r2.start + r2.len]);

                    next_runs.push(Run {
                        start: r1.start,
                        len: r1.len + r2.len,
                    });
                    idx += 2;
                } else {
                    next_runs.push(runs[idx]);
                    idx += 1;
                }
            }
            runs = next_runs;
        }
    }

    fn merge_two(a: &[usize], b: &[usize], out: &mut [usize]) {
        let (mut i, mut j, mut k) = (0, 0, 0);
        while i < a.len() && j < b.len() {
            if a[i] <= b[j] {
                out[k] = a[i];
                i += 1;
            } else {
                out[k] = b[j];
                j += 1;
            }
            k += 1;
        }
        if i < a.len() {
            out[k..].copy_from_slice(&a[i..]);
        }
        if j < b.len() {
            out[k..].copy_from_slice(&b[j..]);
        }
    }
}

// ==========================================
// 4. Точка входа
// ==========================================
fn main() {
    let n = 100_000;
    let distributions = [
        "Sorted",
        "Reverse-Sorted",
        "Almost-Sorted",
        "Sorted-Blocks",
        "Random",
    ];

    println!("Benchmarking N = {} across input distributions\n", n);
    println!(
        "{:<15} | {:<12} | {:<12} | {:<8} | {:<10} | {:<10}",
        "Dataset", "Quicksort", "Run-Aware", "Speedup", "Runs", "Avg Run Len"
    );
    println!("{}", "-".repeat(80));

    for name in distributions {
        let data = ArrayGenerator::generate(name, n);

        // Quicksort
        let mut arr_qs = data.clone();
        let start_qs = Instant::now();
        QuickSort::sort_random(&mut arr_qs);
        let time_qs = start_qs.elapsed().as_micros();

        // RunAware
        let mut arr_ra = data.clone();
        let start_ra = Instant::now();
        let (run_cnt, avg_len) = RunAwareSort::sort(&mut arr_ra);
        let time_ra = start_ra.elapsed().as_micros();

        assert_eq!(arr_qs, arr_ra, "Validation failed for {}", name);

        let speedup = time_qs as f64 / time_ra.max(1) as f64;
        let runs_str = if run_cnt == 0 {
            "Fallback".to_string()
        } else {
            run_cnt.to_string()
        };
        let avg_str = if run_cnt == 0 {
            "-".to_string()
        } else {
            avg_len.to_string()
        };

        println!(
            "{:<15} | {:>8} µs  | {:>8} µs  | {:>6.2}x  | {:<10} | {:<10}",
            name, time_qs, time_ra, speedup, runs_str, avg_str
        );
    }
}