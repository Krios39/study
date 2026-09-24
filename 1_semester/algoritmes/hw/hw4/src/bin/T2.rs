fn main() {
    // Генерируем идеальный массив через вашу идею с переворотом уровней
    let base_arr: Vec<i32> = (1..=20).collect();
    let final_heap = reverse_all_tree_levels(&base_arr);

    println!("=== 1. FINAL ARRAY & INSERTION ORDER ===");
    println!("{:?}\n", final_heap);

    println!("=== 2. FINAL TREE ===");
    print_tree_visual(&final_heap);

    println!("\n=== 3. AUTOMATIC VERIFICATION (BOTH CONDITIONS) ===");
    let is_heap = verify_min_heap(&final_heap);
    println!("Condition 1: Is valid Min-Heap? {}\n", is_heap);

    println!("Condition 2: Left-Heavy Subtree Sums (Only nodes with 2 children):");
    verify_left_heavy(&final_heap);

    println!("\n=== 4. AUTOMATIC REPLAY (INSERTION) ===");
    simulate_insertion(&final_heap);
}

fn reverse_all_tree_levels(arr: &[i32]) -> Vec<i32> {
    let mut new_arr = arr.to_vec();
    let len = new_arr.len();
    let mut level = 1;

    while (1 << level) - 1 < len {
        let start = (1 << level) - 1;
        let end = std::cmp::min((1 << (level + 1)) - 1, len);
        new_arr[start..end].reverse();
        level += 1;
    }
    new_arr
}

fn verify_min_heap(arr: &[i32]) -> bool {
    let n = arr.len();
    for i in 0..n {
        let left = 2 * i + 1;
        let right = 2 * i + 2;
        if left < n && arr[i] > arr[left] { return false; }
        if right < n && arr[i] > arr[right] { return false; }
    }
    true
}

fn get_subtree_sum(arr: &[i32], idx: usize) -> i32 {
    if idx >= arr.len() { return 0; }
    arr[idx] + get_subtree_sum(arr, 2 * idx + 1) + get_subtree_sum(arr, 2 * idx + 2)
}

fn verify_left_heavy(arr: &[i32]) {
    let n = arr.len();
    println!("{:-<65}", "");
    println!("{:<6} | {:<6} | {:<11} | {:<12} | {}", "Index", "Value", "Sum(Left)", "Sum(Right)", "L > R");
    println!("{:-<65}", "");

    for i in 0..n {
        let left = 2 * i + 1;
        let right = 2 * i + 2;
        if left < n && right < n {
            let left_sum = get_subtree_sum(arr, left);
            let right_sum = get_subtree_sum(arr, right);
            println!("{:<6} | {:<6} | {:<11} | {:<12} | {}", i, arr[i], left_sum, right_sum, left_sum > right_sum);
        }
    }
    println!("{:-<65}", "");
}

fn simulate_insertion(arr: &[i32]) {
    let mut online_heap = Vec::new();
    let mut total_swaps = 0;

    for &val in arr {
        online_heap.push(val);
        let mut idx = online_heap.len() - 1;
        while idx > 0 {
            let parent = (idx - 1) / 2;
            if online_heap[idx] < online_heap[parent] {
                online_heap.swap(idx, parent);
                total_swaps += 1;
                idx = parent;
            } else {
                break;
            }
        }
    }
    println!("Total elements inserted: {}", online_heap.len());
    println!("Total swaps required:    {}", total_swaps);
}

fn print_tree_visual(arr: &[i32]) {
    fn recurse(arr: &[i32], idx: usize, prefix: &str, is_left: bool) {
        if idx >= arr.len() { return; }
        let left = 2 * idx + 1;
        let right = 2 * idx + 2;

        let mut right_prefix = prefix.to_string();
        right_prefix.push_str(if is_left { "│   " } else { "    " });
        recurse(arr, right, &right_prefix, false);

        let branch = if idx == 0 { "" } else if is_left { "└── " } else { "┌── " };
        println!("{}{}{}", prefix, branch, arr[idx]);

        let mut left_prefix = prefix.to_string();
        left_prefix.push_str(if is_left { "    " } else { "│   " });
        recurse(arr, left, &left_prefix, true);
    }
    recurse(arr, 0, "", true);
}