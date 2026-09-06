extern crate rand;

use std::hint::black_box;
use std::time::Instant;

fn main() {
    println!("=== Protocol 1: Setup Pollution (Small matrix + allocation inside timer) ===");
    run_flawed_protocol_1();

    println!("\n=== Protocol 2: Dead Code Elimination (Dev/Release trap, no black_box) ===");
    run_flawed_protocol_2();

    println!("\n=== Protocol 3: Corrected Protocol (Warm-up, black_box, median of runs) ===");
    run_corrected_protocol();
}

fn generate_matrix(size: usize) -> Vec<Vec<i32>> {
    let matrix = (0..size)
        .map(|_| (0..size).map(|_| rand::random_range(0..10_000)).collect())
        .collect();
    matrix
}

fn sum_matrix_elements_by_row(matrix: &Vec<Vec<i32>>) -> i64 {
    let mut sum: i64 = 0;
    for i in 0..matrix.len() {
        for j in 0..matrix[i].len() {
            sum += matrix[i][j] as i64;
        }
    }
    sum
}

fn sum_matrix_elements_by_column(matrix: &Vec<Vec<i32>>) -> i64 {
    let mut sum: i64 = 0;
    for i in 0..matrix.len() {
        for j in 0..matrix[i].len() {
            sum += matrix[j][i] as i64;
        }
    }
    sum
}


fn run_flawed_protocol_1() {
    let size = 128;

    let t0 = Instant::now();
    let m1 = generate_matrix(size);
    let s1 = sum_matrix_elements_by_row(&m1);
    let row_time = t0.elapsed().as_micros();
    black_box(s1);

    let t1 = Instant::now();
    let m2 = generate_matrix(size);
    let s2 = sum_matrix_elements_by_column(&m2);
    let col_time = t1.elapsed().as_micros();
    black_box(s2);

    println!("Flawed 1 (Row + Setup):    {} µs", row_time);
    println!("Flawed 1 (Column + Setup): {} µs", col_time);
    println!("Flawed Conclusion: Setup cost hides traversal impact completely.");
}

fn run_flawed_protocol_2() {
    let matrix = generate_matrix(8192);

    let t0 = Instant::now();
    let _ = sum_matrix_elements_by_row(&matrix);
    let row_time = t0.elapsed().as_micros();

    let t1 = Instant::now();
    let _ = sum_matrix_elements_by_column(&matrix);
    let col_time = t1.elapsed().as_micros();

    println!("Flawed 2 (Row without black_box):    {} µs", row_time);
    println!("Flawed 2 (Column without black_box): {} µs", col_time);
    println!("Flawed Conclusion: Row is 'infinitely' faster because compiler deleted the code.");
}

fn run_corrected_protocol() {
    let size = 8192;
    println!("Generating matrix {}x{} outside the timer...", size, size);
    let matrix = generate_matrix(size);

    println!("Warming up...");
    for _ in 0..2 {
        black_box(sum_matrix_elements_by_row(&matrix));
        black_box(sum_matrix_elements_by_column(&matrix));
    }

    let runs = 5;
    let mut row_times = Vec::new();
    let mut col_times = Vec::new();

    println!("Running {} benchmark iterations...", runs);
    for _ in 0..runs {
        let t0 = Instant::now();
        black_box(sum_matrix_elements_by_row(&matrix));
        row_times.push(t0.elapsed().as_micros());

        let t1 = Instant::now();
        black_box(sum_matrix_elements_by_column(&matrix));
        col_times.push(t1.elapsed().as_micros());
    }

    row_times.sort_unstable();
    col_times.sort_unstable();
    let median_row = row_times[runs / 2];
    let median_col = col_times[runs / 2];

    println!("Raw Row times (µs): {:?}", row_times);
    println!("Raw Column times (µs): {:?}", col_times);
    println!("Median Row:    {} µs", median_row);
    println!("Median Column: {} µs", median_col);
    println!(
        "Corrected Conclusion: Row traversal is ~{:.2}x faster due to spatial cache locality.",
        (median_col as f64) / (median_row as f64)
    );
}