extern crate rand;
use std::time::Instant;

const SIZE: usize = 5;
const TRIALS: usize = 7;
const LARGE_SIZES: [i32; SIZE] = [100, 1_000, 10_000, 100_000, 1_000_000];
const QUADRATIC_SIZES: [i32; SIZE] = [1_000, 2_000, 4_000, 8_000, 16_000];
const HELD_OUT_QUADRATIC: i32 = 32_000;

fn main() {
    println!("=== 1. LINEAR SCAN (ns) ===");
    for size in LARGE_SIZES {
        let mut runs = Vec::with_capacity(TRIALS);
        for _ in 0..TRIALS {
            let data = create_random_array(size);

            let linear_start = Instant::now();
            let _res = linear_scan(&data);
            let linear_time = linear_start.elapsed().as_nanos();

            runs.push(linear_time);
        }
        runs.sort();
        let median = runs[TRIALS / 2];
        println!("n = {:<8} | runs: {:?} | median: {}", size, runs, median);
    }

    println!("\n=== 2. LIBRARY SORT (ns) ===");
    for size in LARGE_SIZES {
        let mut runs = Vec::with_capacity(TRIALS);
        for _ in 0..TRIALS {
            let data = create_random_array(size);

            let sort_start = Instant::now();
            let _res = lib_sort(&data);
            let sort_time = sort_start.elapsed().as_nanos();

            runs.push(sort_time);
        }
        runs.sort();
        let median = runs[TRIALS / 2];
        println!("n = {:<8} | runs: {:?} | median: {}", size, runs, median);
    }

    println!("\n=== 3. QUADRATIC INVERSIONS (ns) ===");
    for size in QUADRATIC_SIZES {
        let mut runs = Vec::with_capacity(TRIALS);
        for _ in 0..TRIALS {
            let data = create_random_array(size);

            let quadratic_start = Instant::now();
            let _res = quadratic_inversion_counter(&data);
            let quadratic_time = quadratic_start.elapsed().as_nanos();

            runs.push(quadratic_time);
        }
        runs.sort();
        let median = runs[TRIALS / 2];
        println!("n = {:<8} | runs: {:?} | median: {}", size, runs, median);
    }

    println!("\n=== 4. HELD-OUT QUADRATIC (n = 32 000) ===");
    let mut runs = Vec::with_capacity(TRIALS);
    for _ in 0..TRIALS {
        let data = create_random_array(HELD_OUT_QUADRATIC);

        let quadratic_start = Instant::now();
        let _res = quadratic_inversion_counter(&data);
        let quadratic_time = quadratic_start.elapsed().as_nanos();

        runs.push(quadratic_time);
    }
    runs.sort();
    let median = runs[TRIALS / 2];
    println!("n = {:<8} | runs: {:?} | median: {}", HELD_OUT_QUADRATIC, runs, median);
}

fn create_random_array(elements_count: i32) -> Vec<i32> {
    let array: Vec<i32> = (0..elements_count).map(|_| rand::random()).collect();
    array
}

fn linear_scan(array: &Vec<i32>) -> i64 {
    let mut counter: i64 = 0;
    for num in 0..(array.len() - 1) {
        counter += (array[num + 1] as i64) - (array[num] as i64);
    }
    counter
}

fn lib_sort(array: &Vec<i32>) -> Vec<i32> {
    let mut copy = array.clone();
    copy.sort();
    copy
}

fn quadratic_inversion_counter(array: &[i32]) -> u64 {
    let mut counter: u64 = 0;
    let n = array.len();

    for i in 0..n {
        for j in (i + 1)..n {
            if array[i] > array[j] {
                counter += 1;
            }
        }
    }
    counter
}