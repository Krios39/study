extern crate rand;
use std::time::Instant;
const SIZE: usize = 5;
const LARGE_SIZES: [i32; SIZE] = [100, 1_000, 10_000, 100_000, 1_000_000];
const QUADRATIC_SIZES: [i32; SIZE] = [1_000, 2_000, 4_000, 8_000, 16_000];
fn main() {
    println!("LinearScan&Sort");

    for size in LARGE_SIZES {
        let data = create_random_array(size);

        let linear_start = Instant::now();
        linear_scan(&data);
        let liner_time = linear_start.elapsed().as_micros();

        let sort_start = Instant::now();
        lib_sort(&data);
        let sort_time = sort_start.elapsed().as_micros();

        println!("{:<10} | {:<18.4} | {:<18.4}", size, liner_time, sort_time);
    }
    println!("Quadratic");

    for size in QUADRATIC_SIZES {
        let data = create_random_array(size);

        let quadratic_start = Instant::now();
        quadratic_inversion_counter(&data);
        let quadratic_time = quadratic_start.elapsed().as_micros();

        println!("{:<10} | {:<18.4}", size, quadratic_time,);
    }
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

fn quadratic_inversion_counter(array: &[i32]) -> i32 {
    let mut counter = 0;
    let n = array.len();

    for i in 0..n {
        for j in i + 1..n {
            if i < j && array[i] > array[j] {
                counter += 1;
            }
        }
    }
    counter
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_linear_scan() {
        let data = vec![1, 5, 2]; // vec!, а не [1, 5, 2]
        assert_eq!(linear_scan(&data), 1);
    }

    #[test]
    fn test_lib_sort() {
        let data = vec![5, 1, 4, 2];
        assert_eq!(lib_sort(&data), vec![1, 2, 4, 5]);
    }

    #[test]
    fn test_quadratic_inversions_manual() {
        let data = [4, 1, 3, 2];
        assert_eq!(quadratic_inversion_counter(&data), 4);
    }

    #[test]
    fn test_quadratic_inversions_sorted() {
        let data = [1, 2, 3, 4, 5];
        assert_eq!(quadratic_inversion_counter(&data), 0);
    }

    #[test]
    fn test_quadratic_inversions_reversed() {
        let data = [5, 4, 3, 2, 1];
        assert_eq!(quadratic_inversion_counter(&data), 10);
    }
}
