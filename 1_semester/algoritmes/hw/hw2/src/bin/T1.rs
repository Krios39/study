
fn main() {
    let mut array: [usize; 7] = [4, 8, 2, 9, 5, 6, 12];

    let mut empty: [usize;0] = [];
    let mut one_element: [usize;1] = [1];
    let two_elements: [usize;2] = [1,2];
    let mut sorted = create_sorted_array(10);
    let mut reversed = create_reversed_array(10);
    let mut duplicates = create_duplicates_array(10);

    println!("Sorted:     {:?}", quick_sort(sorted.as_mut_slice()));
    println!("Reversed:   {:?}", quick_sort(reversed.as_mut_slice()));
    println!("Duplicates: {:?}", quick_sort(duplicates.as_mut_slice()));
    println!("Array {:?}", quick_sort(array.as_mut_slice()));
}

fn create_random_array(elements_count: usize) -> Vec<usize> {
    (0..elements_count)
        .map(|_| rand::random::<u32>() as usize)
        .collect()
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

    let mut lt = 1;
    let mut gt = arr.len() - 2;
    let mut k = lt;

    while k <= gt {
        if arr[k] > r_pivot {
            swap(arr, gt, k);
            gt -= 1;
        } else if arr[k] < l_pivot {
            swap(arr, lt, k);
            lt += 1;
            k += 1;
        } else {
            k += 1;
        }
    }

    swap(arr, 0, lt - 1);
    swap(arr, arr.len() - 1, gt + 1);

    let (left, rest) = arr.split_at_mut(lt - 1);
    let mid_len = (gt + 1) - (lt - 1) - 1;
    let (mid, right) = rest[1..].split_at_mut(mid_len);

    quick_sort(left);
    quick_sort(mid);
    quick_sort(&mut right[1..]);

    arr
}