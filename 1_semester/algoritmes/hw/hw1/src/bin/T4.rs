use rand::rngs::StdRng;
use rand::seq::SliceRandom;
use rand::{RngExt, SeedableRng};
use std::collections::HashSet;
const ARRAY_SIZE: usize = 10_000;
const ZIPF_S: f64 = 1.2;

fn main() {
    test_fn();

    let mut rng = StdRng::seed_from_u64(2026);


    let mut array_a1: Vec<i32> = (0..ARRAY_SIZE as i32).collect();
    array_a1.shuffle(&mut rng);
    let mut array_a2: Vec<i32> = (0..ARRAY_SIZE as i32).collect();
    let mut array_a3: Vec<i32> = (0..ARRAY_SIZE as i32).rev().collect();

    let base_sorted: Vec<i32> = (0..ARRAY_SIZE as i32).collect();
    let mut blocks: Vec<&[i32]> = base_sorted.chunks_exact(100).collect();
    blocks.shuffle(&mut rng);
    let mut array_a4: Vec<i32> = blocks.into_iter().flatten().copied().collect();

    println!("=== EXPERIMENT A ===");
    run_benchmark("Random Permutation", &mut array_a1);
    run_benchmark("Sorted", &mut array_a2);
    run_benchmark("Reverse-Sorted", &mut array_a3);
    run_benchmark("100 Sorted Blocks", &mut array_a4);

    let mut array_b1: Vec<i32> = (0..ARRAY_SIZE)
        .map(|_| rng.random_range(1..=ARRAY_SIZE as i32))
        .collect();
    let mut array_b2: Vec<i32> = generate_zipf(ARRAY_SIZE, ARRAY_SIZE as i32, ZIPF_S, &mut rng);

    println!("\n=== EXPERIMENT B ===");
    run_benchmark("Uniform Sample", &mut array_b1);
    run_benchmark(&format!("Zipf Sample (s={ZIPF_S})"), &mut array_b2);}

fn run_benchmark(name: &str, array: &mut [i32]) {
    let distinct = array.iter().copied().collect::<HashSet<_>>().len();

    let mut expected = array.to_vec();
    expected.sort();

    let (result, comparisons, shifts) = insertion_sort_counter(array);

    assert_eq!(result, &mut expected[..]);

    println!(
        "{:<20} | Distinct: {:>5} | Comparisons: {:>8} | Shifts: {:>8}",
        name, distinct, comparisons, shifts
    );
}

fn insertion_sort_counter(array: &mut [i32]) -> (&mut [i32], usize, usize) {
    let mut comparisons = 0;
    let mut shifts = 0;

    for i in 1..array.len() {
        let key = array[i];
        let mut j = i;

        while j > 0 {
            comparisons += 1;
            if array[j - 1] <= key {
                break;
            }
            array[j] = array[j - 1];
            shifts += 1;
            j -= 1;
        }
        array[j] = key;
    }

    (array, comparisons, shifts)
}

fn generate_zipf(len: usize, max_val: i32, s: f64, rng: &mut StdRng) -> Vec<i32> {
    let mut cdf = Vec::with_capacity(max_val as usize);
    let mut current_sum = 0.0;

    for r in 1..=max_val {
        current_sum += 1.0 / (r as f64).powf(s);
        cdf.push(current_sum);
    }

    let total_sum = current_sum;

    (0..len)
        .map(|_| {
            let p: f64 = rng.random_range(0.0..total_sum);
            let rank = cdf.partition_point(|&val| val < p) + 1;
            rank as i32
        })
        .collect()
}
fn test_fn() {
    let tests: [Vec<i32>; 5] = [
        vec![],
        vec![1],
        vec![3, 1, 2],
        vec![2, 2, 1],
        vec![5, 4, 3, 2, 1],
    ];

    for mut test in tests {
        let mut expected = test.clone();
        expected.sort();

        let (result, _, _) = insertion_sort_counter(&mut test);
        assert_eq!(result, &mut expected[..]);
    }
}