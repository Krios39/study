use std::time::Instant;

const MAX_DEPTH_LIMIT: usize = 1200;

struct ArrayGenerator;
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

    fn generate(name: &str, n: usize) -> Vec<usize> {
        match name {
            "Sorted" => Self::sorted(n),
            "Reverse-Sorted" => Self::reversed(n),
            "Almost-Sorted" => Self::almost_sorted(n),
            "Random" => Self::random(n),
            "Duplicates" => Self::duplicates(n),
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

fn main() {
    let sizes = [1000, 2000, 5000, 10000];
    let datasets = [
        "Sorted",
        "Reverse-Sorted",
        "Almost-Sorted",
        "Random",
        "Duplicates",
    ];

    for &name in &datasets {
        println!("\n=== Dataset: {} ===", name);
        println!(
            "{:<6} | {:<16} | {:<14} | {:<12} | {:<10}",
            "Size", "Strategy", "Comparisons", "Max Depth", "Time (µs)"
        );
        println!("{:-<65}", "");

        for &n in &sizes {
            let mut arr_det = ArrayGenerator::generate(name, n);
            let mut det = QuickSort::new(false);
            let start = Instant::now();
            det.sort(&mut arr_det);
            let time_det = start.elapsed().as_micros();

            if det.aborted {
                println!(
                    "{:<6} | {:<16} | {:<14} | {:<12} | {:<10}",
                    n, "Deterministic", "FAIL (Aborted)", format!(">={}", MAX_DEPTH_LIMIT), "TIMEOUT"
                );
            } else {
                println!(
                    "{:<6} | {:<16} | {:<14} | {:<12} | {:<10}",
                    n, "Deterministic", det.comparisons, det.max_depth, time_det
                );
            }

            let mut cmps = vec![];
            let mut depths = vec![];
            let mut times = vec![];

            for _ in 0..5 {
                let mut arr_rand = ArrayGenerator::generate(name, n);
                let mut rnd = QuickSort::new(true);
                let start = Instant::now();
                rnd.sort(&mut arr_rand);
                let time = start.elapsed().as_micros();

                cmps.push(rnd.comparisons);
                depths.push(rnd.max_depth);
                times.push(time);
            }

            cmps.sort();
            depths.sort();
            times.sort();

            println!(
                "{:<6} | {:<16} | {:<14} | {:<12} | {:<10}",
                n, "Random (median)", cmps[2], depths[2], times[2]
            );
        }
    }
}