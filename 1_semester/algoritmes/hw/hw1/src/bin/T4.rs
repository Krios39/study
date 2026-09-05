use rand::{RngExt, SeedableRng};
use rand::rngs::StdRng;
use rand::seq::SliceRandom;
const ARRAY_SIZE: usize = 10_000;
const MAX_VALUE_1: i32 = 9999;
const MAX_VALUE_2: i32 = 10_000;
const ZIPF: f64 = 1.2;
fn main() {
    let mut rng = StdRng::seed_from_u64(2026);

    let mut array1_1: Vec<i32> = (0..ARRAY_SIZE).map(|_| rng.random_range(0..MAX_VALUE_1)).collect();
    let mut array1_2: Vec<i32> =  (0..10_000).collect();
    let mut array1_3: Vec<i32> =  (0..10_000).rev().collect();

    let mut blocks: Vec<&[i32]> = array1_2.chunks_exact(100).collect();
    blocks.shuffle(&mut rng);
    let array1_4: Vec<i32> = blocks.into_iter().flatten().copied().collect();

    let mut array2_1: Vec<i32> = (0..ARRAY_SIZE).map(|_| rng.random_range(0..MAX_VALUE_2)).collect();
    let mut array2_2: Vec<i32> = generate_zipf(ARRAY_SIZE,MAX_VALUE_2,ZIPF, &mut rng);


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
fn test_fn(){
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

        let (result, comparisons, shifts) = insertion_sort_counter(&mut test);

        println!(
            "Sorted: {:?}, Comparisons: {}, Shifts: {}",
            result, comparisons, shifts
        );

        assert_eq!(result, &mut expected[..]);
    }
}