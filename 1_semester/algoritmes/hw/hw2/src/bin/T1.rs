const N :usize = 1000;

fn main() {
    assert_matches_library_sort("Empty array", vec![]);
    assert_matches_library_sort("Single element", vec![42]);
    assert_matches_library_sort("Two elements sorted", vec![1, 2]);
    assert_matches_library_sort("Two elements unsorted", vec![9, 3]);


    assert_matches_library_sort("Sorted array (1000)", create_sorted_array(N));
    assert_matches_library_sort("Reversed array (1000)", create_reversed_array(N));
    assert_matches_library_sort("All equal array (1000)", create_all_equal_array(N, 7));
    assert_matches_library_sort("Duplicate-heavy array (1000)", create_duplicates_array(N));
    assert_matches_library_sort("Random array (1000)", create_random_array(N));

    println!("\nAll test cases passed successfully!");
}

fn create_sorted_array(elements_count: usize) -> Vec<usize> {
    (0..elements_count).collect()
}

fn create_reversed_array(elements_count: usize) -> Vec<usize> {
    (0..elements_count).rev().collect()
}

fn create_duplicates_array(elements_count: usize) -> Vec<usize> {
    (0..elements_count)
        .map(|_| (rand::random::<u32>() % 5) as usize)
        .collect()
}

fn create_all_equal_array(elements_count: usize, val: usize) -> Vec<usize> {
    vec![val; elements_count]
}
fn quick_sort(arr: &mut [usize]) -> &mut [usize] {
    if arr.len() <= 1 {
        return arr;
    }

    fn swap(arr: &mut [usize], i: usize, j: usize) {
        let tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }

    if arr.len() == 2 {
        if arr[0] > arr[1] {
            swap(arr, 0, 1);
        }
        return arr;
    }

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

    while k <= gt {
        if arr[k] < l_pivot {
            swap(arr, lt, k);
            lt += 1;
            k += 1;
        } else if arr[k] > r_pivot {
            swap(arr, gt, k);
            gt -= 1;
        } else {
            k += 1;
        }
    }

    let p1_idx = lt - 1;
    let p2_idx = gt + 1;
    swap(arr, 0, p1_idx);
    swap(arr, arr.len() - 1, p2_idx);

    let (left, rest) = arr.split_at_mut(p1_idx);
    let mid_len = p2_idx - p1_idx - 1;
    let (mid, right) = rest[1..].split_at_mut(mid_len);

    quick_sort(left);

    if !pivots_are_equal {
        quick_sort(mid);
    }

    quick_sort(&mut right[1..]);

    arr
}

fn create_random_array(elements_count: usize) -> Vec<usize> {
    (0..elements_count)
        .map(|_| rand::random::<u32>() as usize)
        .collect()
}

fn assert_matches_library_sort(name: &str, mut actual: Vec<usize>) {
    let mut expected = actual.clone();
    expected.sort();
    quick_sort(actual.as_mut_slice());
    assert_eq!(actual, expected, "Failed test case: {name}");
    println!("✓ PASS: {name}");
}