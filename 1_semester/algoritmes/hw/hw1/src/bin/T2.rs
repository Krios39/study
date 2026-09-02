extern crate rand;
const ARRAYS_COUNT: usize = 10;
const ARRAY_SIZE: usize = 5;
const LARGE_SIZES: [i32; ARRAY_SIZE] = [100, 1_000, 10_000, 100_000, 1_000_000];
fn main() {
    let mut arrays: [[i32; ARRAY_SIZE]; ARRAYS_COUNT] = [[0; ARRAY_SIZE]; ARRAYS_COUNT];

    for i in 0..ARRAYS_COUNT {
        arrays[i] = create_random_array()
    }

    for i in 0..ARRAYS_COUNT {
        println!("{:?}", arrays[i]);
    }

    for i in 0..ARRAYS_COUNT {
        let sorted_array = lib_sort(arrays[i]);
        linear_scan(sorted_array, sorted_array.len());
    }
    lib_sort(LARGE_SIZES);
}


fn create_random_array()-> [i32; ARRAY_SIZE] {
    let mut array: [i32; ARRAY_SIZE] = [0; ARRAY_SIZE];

    for num in 0..ARRAY_SIZE {
        array[num] = rand::random_range(0..LARGE_SIZES[rand::random_range(0..LARGE_SIZES.len())]);
    }
    array
}

fn linear_scan(array: [i32; ARRAY_SIZE], array_size: usize)  {
    let mut counter: i32 = 0;
    for num in 0..(array_size - 1) {
        counter += (array[num + 1] - array[num]);
    }
    println!("Counter count {counter} ",);
}

fn lib_sort(array: [i32; ARRAY_SIZE])->[i32; ARRAY_SIZE] {
    let mut copy = array.clone();
    copy.sort();
    copy
}

fn quadratic_inversion_counter() {}
