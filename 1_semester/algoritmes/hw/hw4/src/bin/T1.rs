fn main() {

    let adversarial_input: [i32; 15] = [
        14,
        13,
        12,
        11, 10, 9, 8,
        0, 1, 2, 3, 4, 5, 6, 7,
    ];

    println!("=== 1. FLOYD'S BOTTOM-UP MIN-HEAPIFY ===");
    let mut heap = adversarial_input;
    println!("Initial:   {:?}", heap);

    let mut total_swaps = 0;
    let mut total_comps = 0;

    // Проходим внутренние вершины от 6 вниз до 0
    for i in (0..=6).rev() {
        let (comps, swaps) = sift_down(&mut heap, i, 15);
        total_comps += comps;
        total_swaps += swaps;
        println!("After i={}: {:?}", i, heap);
    }

    println!("\nBottom-up results:");
    println!("Key comparisons: {}", total_comps);
    println!("Swaps:           {} (Theoretical max = 11)", total_swaps);
    println!("Is valid min-heap: {}", is_min_heap(&heap));

    println!("\n=== 2. SEQUENTIAL INSERTION ( Williams ) ===");
    let mut online_heap = Vec::new();
    let mut insert_swaps = 0;
    let mut insert_comps = 0;

    for &val in &adversarial_input {
        let (comps, swaps) = insert_min_heap(&mut online_heap, val);
        insert_comps += comps;
        insert_swaps += swaps;
    }

    println!("Final online heap: {:?}", online_heap);
    println!("Key comparisons:   {}", insert_comps);
    println!("Swaps:             {}", insert_swaps);
    println!("Is valid min-heap: {}", is_min_heap(&online_heap));
}

fn sift_down(arr: &mut [i32], mut idx: usize, n: usize) -> (usize, usize) {
    let mut comparisons = 0;
    let mut swaps = 0;

    loop {
        let left = 2 * idx + 1;
        let right = 2 * idx + 2;

        if left >= n {
            break;
        }

        let mut smallest = left;
        if right < n {
            comparisons += 1;
            if arr[right] < arr[left] {
                smallest = right;
            }
        }

        comparisons += 1;
        if arr[smallest] < arr[idx] {
            arr.swap(idx, smallest);
            swaps += 1;
            idx = smallest;
        } else {
            break;
        }
    }

    (comparisons, swaps)
}

fn insert_min_heap(heap: &mut Vec<i32>, val: i32) -> (usize, usize) {
    heap.push(val);
    let mut idx = heap.len() - 1;
    let mut comps = 0;
    let mut swaps = 0;

    while idx > 0 {
        let parent = (idx - 1) / 2;
        comps += 1;
        if heap[idx] < heap[parent] {
            heap.swap(idx, parent);
            swaps += 1;
            idx = parent;
        } else {
            break;
        }
    }

    (comps, swaps)
}

fn is_min_heap(arr: &[i32]) -> bool {
    let n = arr.len();
    for i in 0..n {
        let left = 2 * i + 1;
        let right = 2 * i + 2;
        if left < n && arr[i] > arr[left] {
            return false;
        }
        if right < n && arr[i] > arr[right] {
            return false;
        }
    }
    true
}