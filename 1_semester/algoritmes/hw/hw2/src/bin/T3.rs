fn main() {
    let base_sorted: Vec<usize> = (0..100).collect();

    println!("index: {:?}", binary_search(base_sorted, 23));
}

fn binary_search(array: Vec<usize>, searched: usize) -> usize {
    let mut k: usize = array.len() / 2;
    let mut left_border = 0;
    let mut right_border = array.len() - 1;

    while array[k] != searched {
        if array[k] > searched {
            right_border = k;
            k = (right_border - left_border) / 2;
        }
        if array[k] < searched {
            left_border = k;
            k = left_border + (right_border - left_border) / 2;
        }
    }

    if array[k] == searched {
        return k;
    }

    return 0;
}
