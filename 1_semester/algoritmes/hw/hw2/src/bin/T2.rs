fn quick_sort(arr: &mut [usize], is_random_pivots: bool) -> &mut [usize] {
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

    let mut l_pivot;
    let mut r_pivot;

    if is_random_pivots {
        let n = arr.len();
        let i = (rand::random::<u32>() as usize) % n;
        let offset = 1 + ((rand::random::<u32>() as usize) % (n - 1));
        let j = (i + offset) % n;
        swap(arr, 0, i);
        let actual_j = if j == 0 { i } else { j };
        swap(arr, n - 1, actual_j);
    }

    l_pivot = arr[0];
    r_pivot = arr[arr.len() - 1];

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

    quick_sort(left, is_random_pivots);

    if !pivots_are_equal {
        quick_sort(mid, is_random_pivots);
    }

    quick_sort(&mut right[1..], is_random_pivots);

    arr
}
