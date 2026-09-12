use rand::rngs::StdRng;
use rand::{RngExt, SeedableRng};
use std::hint::black_box;
use std::time::{Duration, Instant};

fn lower_bound(array: &[u32], searched: u32) -> (usize, usize) {
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

fn test_correctness() {
    let test_array = vec![10, 20, 20, 30, 40, 50];

    assert_eq!(lower_bound(&test_array, 5).0, 0); // меньше минимального
    assert_eq!(lower_bound(&test_array, 10).0, 0); // первое значение
    assert_eq!(lower_bound(&test_array, 20).0, 1); // первый дубликат
    assert_eq!(lower_bound(&test_array, 25).0, 3); // между 20 и 30
    assert_eq!(lower_bound(&test_array, 50).0, 5); // последнее значение
    assert_eq!(lower_bound(&test_array, 55).0, 6); // больше максимального
    assert_eq!(lower_bound(&[], 10).0, 0); // пустой массив

    println!("Correctness tests passed!");
}

fn benchmark(array: &[u32], queries: &[u32], duration: Duration) -> (usize, f64, Duration) {
    let mut total_searches = 0;
    let mut total_comparisons = 0;
    let mut q_idx = 0;
    let q_len = queries.len();

    let start = Instant::now();
    while start.elapsed() < duration {
        let (idx, comps) = lower_bound(array, queries[q_idx]);
        black_box(idx);

        total_comparisons += comps;
        total_searches += 1;

        q_idx += 1;
        if q_idx == q_len {
            q_idx = 0;
        }
    }

    let elapsed = start.elapsed();
    let avg_comps = total_comparisons as f64 / total_searches as f64;
    (total_searches, avg_comps, elapsed)
}

fn main() {
    test_correctness();

    let n0: usize = 10_000_000;
    println!("\nArray: Vec<u32>");
    println!("Elements: {}", n0);
    println!(
        "Memory: {:.2} MB",
        (n0 * std::mem::size_of::<u32>()) as f64 / (1024.0 * 1024.0)
    );

    let base_sorted: Vec<u32> = (0..n0 as u32).map(|x| x * 2).collect();

    let mut rng = StdRng::seed_from_u64(2026);
    let query_count = 2_000_000;
    let max_val = (n0 as u32) * 2;
    let queries: Vec<u32> = (0..query_count)
        .map(|_| rng.random_range(0..max_val))
        .collect();

    println!("\n[Run 1/3] Running 10s baseline for n0 = {}...", n0);
    let (base_ops, base_comps, base_time) =
        benchmark(&base_sorted, &queries, Duration::from_secs(10));
    let base_time_per_search = base_time.as_nanos() as f64 / base_ops as f64;

    println!("Baseline searches in 10s: {}", base_ops);
    println!("Average comparisons:      {:.2}", base_comps);
    println!("Time per search:          {:.2} ns", base_time_per_search);

    let target_ops = base_ops * 2;
    println!("Target operations (2x):   {}", target_ops);

    println!("\n--- Outer Search Trace (Bisection with 0.5s pilot runs) ---");
    let mut low = 1_000_000;
    let mut high = n0 - 1;
    let mut found_n = low;

    for step in 1..=8 {
        let mid = low + (high - low) / 2;
        let (p_ops, _, p_time) = benchmark(&base_sorted[0..mid], &queries, Duration::from_millis(500));
        let est_10s = (p_ops as f64 * (10.0 / p_time.as_secs_f64())) as usize;
        let speedup = est_10s as f64 / base_ops as f64;

        println!(
            "Step {:>2} | Candidate n = {:>8} | Projected 10s: {:>10} ({:.2}x)",
            step, mid, est_10s, speedup
        );

        if est_10s >= target_ops {
            // Ускорение >= 2x достигнуто, пробуем взять n еще БОЛЬШЕ (двигаемся вправо)
            found_n = mid;
            low = mid + 1;
        } else {
            // Ускорения 2x не хватает, уменьшаем n (двигаемся влево)
            high = mid - 1;
        }

        if low > high {
            break;
        }
    }

    println!("\n[Run 2/3] Verification 10s run for n = {}...", found_n);
    let (final_ops, final_comps, final_time) =
        benchmark(&base_sorted[0..found_n], &queries, Duration::from_secs(10));
    let final_time_per_search = final_time.as_nanos() as f64 / final_ops as f64;

    println!("Final searches in 10s:    {}", final_ops);
    println!("Final comparisons:        {:.2}", final_comps);
    println!("Final time per search:    {:.2} ns", final_time_per_search);
    println!("Resulting size n:         {}", found_n);
    println!(
        "Reduction factor (n0 / n):{:.2}x",
        n0 as f64 / found_n as f64
    );
    println!(
        "Achieved throughput gain: {:.2}x",
        final_ops as f64 / base_ops as f64
    );
}
