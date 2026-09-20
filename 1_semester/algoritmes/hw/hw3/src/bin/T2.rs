use hw3::bst::{BST, Node};
use hw3::collatz::{collatz_conjecture};

use std::collections::{HashMap, HashSet, VecDeque};
fn main() {
    println!("===========================================================");
    println!("=== PART 1: VALIDATING ON SMALL HAND-BUILT TREES (<= 12 nodes) ===");
    println!("===========================================================\n");

    // Test 1: All negative. Алгоритм должен взять наименьший минус, не суммируя их.
    let test1 = BST::from_vec(vec![-10, -20, -5]);
    println!("Test 1 (All negative tree):");
    let (opt_sum1, opt_path1) = optimal_max_path(&test1);
    let (bf_sum1, bf_path1) = brute_force_validator(&test1);
    println!("  Optimal O(N): Sum = {:>4}, Path = {:?}", opt_sum1, opt_path1);
    println!("  Brute-Force:  Sum = {:>4}, Path = {:?}\n", bf_sum1, bf_path1);

    // Test 2: Arch scenario. Выгодно подняться через корень и спуститься вправо.
    let test2 = BST::from_vec(vec![10, 5, 15]);
    println!("Test 2 (Arch across the root):");
    let (opt_sum2, opt_path2) = optimal_max_path(&test2);
    let (bf_sum2, bf_path2) = brute_force_validator(&test2);
    println!("  Optimal O(N): Sum = {:>4}, Path = {:?}", opt_sum2, opt_path2);
    println!("  Brute-Force:  Sum = {:>4}, Path = {:?}\n", bf_sum2, bf_path2);

    // Test 3: Deep arch. Выгодно проигнорировать отрицательный корень (-10) и сделать арку внизу.
    let test3 = BST::from_vec(vec![-10, -20, 20, 15, 25]);
    println!("Test 3 (Deep arch ignoring the root):");
    let (opt_sum3, opt_path3) = optimal_max_path(&test3);
    let (bf_sum3, bf_path3) = brute_force_validator(&test3);
    println!("  Optimal O(N): Sum = {:>4}, Path = {:?}", opt_sum3, opt_path3);
    println!("  Brute-Force:  Sum = {:>4}, Path = {:?}\n", bf_sum3, bf_path3);

    // Test 4: One-ended choice. Обрезка отрицательных хвостов.
    let test4 = BST::from_vec(vec![10, 5, -20, 20]);
    println!("Test 4 (Best one-ended path choice):");
    let (opt_sum4, opt_path4) = optimal_max_path(&test4);
    let (bf_sum4, bf_path4) = brute_force_validator(&test4);
    println!("  Optimal O(N): Sum = {:>4}, Path = {:?}", opt_sum4, opt_path4);
    println!("  Brute-Force:  Sum = {:>4}, Path = {:?}\n", bf_sum4, bf_path4);


    println!("===========================================================");
    println!("=== PART 2: MAXIMUM PATH IN MIXED-SIGN COLLATZ TREES ===");
    println!("===========================================================\n");

    let colatz7 = collatz_conjecture(7);
    let colatz9 = collatz_conjecture(9);
    let colatz51 = collatz_conjecture(51);

    let tree7 = BST::from_vec(colatz7);
    let tree9 = BST::from_vec(colatz9);
    let tree51 = BST::from_vec(colatz51);

    // Портим деревья: умножаем каждый третий узел на -1 в порядке BFS
    let mixed_tree7 = create_corrupted_tree(&tree7);
    let mixed_tree9 = create_corrupted_tree(&tree9);
    let mixed_tree51 = create_corrupted_tree(&tree51);

    let (sum7, path7) = optimal_max_path(&mixed_tree7);
    println!("Collatz 7 Mixed-Sign Tree (Total nodes: {}):", tree7.node_count());
    println!("  Max Path Sum: {}", sum7);
    println!("  Reconstructed Path: {:?}\n", path7);

    let (sum9, path9) = optimal_max_path(&mixed_tree9);
    println!("Collatz 9 Mixed-Sign Tree (Total nodes: {}):", tree9.node_count());
    println!("  Max Path Sum: {}", sum9);
    println!("  Reconstructed Path: {:?}\n", path9);

    let (sum51, path51) = optimal_max_path(&mixed_tree51);
    println!("Collatz 51 Mixed-Sign Tree (Total nodes: {}):", tree51.node_count());
    println!("  Max Path Sum: {}", sum51);
    println!("  Reconstructed Path: {:?}\n", path51);


    println!("===========================================================");
    println!("=== PART 3: THE HUGE COLLATZ TREE ===");
    println!("===========================================================\n");

    // Берем стартовое число-рекордсмен из вашей первой задачи
    let colatz_longest = collatz_conjecture(77031);
    let tree_longest = BST::from_vec(colatz_longest);
    let mixed_tree_longest = create_corrupted_tree(&tree_longest);

    let (sum_huge, path_huge) = optimal_max_path(&mixed_tree_longest);
    println!("Collatz 77031 Mixed-Sign Tree (Total nodes: {}):", tree_longest.node_count());
    println!("  Max Path Sum: {}", sum_huge);
    println!("  Path length: {} nodes", path_huge.len());
    println!("  Reconstructed Path: {:?}", path_huge);
}

fn create_corrupted_tree(original_tree: &BST<i32>) -> BST<i32> {
    let mut new_tree = original_tree.clone();

    if new_tree.root.is_none() {
        return new_tree;
    }

    let mut queue = VecDeque::new();
    queue.push_back(new_tree.root.as_mut().unwrap());

    let mut count = 1;

    while let Some(node) = queue.pop_front() {
        if count % 3 == 0 {
            node.value = -node.value;
        }
        count += 1;

        if let Some(ref mut left) = node.left {
            queue.push_back(left);
        }

        if let Some(ref mut right) = node.right {
            queue.push_back(right);
        }
    }

    new_tree
}


pub fn optimal_max_path(tree: &BST<i32>) -> (i32, Vec<i32>) {
    if tree.root.is_none() {
        return (0, Vec::new());
    }

    let mut global_max = i32::MIN;
    let mut global_path = Vec::new();

    optimal_max_path_rec(&tree.root, &mut global_max, &mut global_path);

    (global_max, global_path)
}

fn optimal_max_path_rec(
    node_opt: &Option<Box<Node<i32>>>,
    global_max: &mut i32,
    global_path: &mut Vec<i32>
) -> (i32, Vec<i32>) {
    let node = match node_opt {
        Some(n) => n,
        None => return (0, Vec::new()),
    };

    let (left_sum, left_path) = optimal_max_path_rec(&node.left, global_max, global_path);
    let (right_sum, right_path) = optimal_max_path_rec(&node.right, global_max, global_path);

    let (l_sum, l_path) = if left_sum > 0 { (left_sum, left_path) } else { (0, Vec::new()) };
    let (r_sum, r_path) = if right_sum > 0 { (right_sum, right_path) } else { (0, Vec::new()) };

    let current_arch_sum = node.value + l_sum + r_sum;

    if current_arch_sum > *global_max {
        *global_max = current_arch_sum;

        let mut arch_path = l_path.clone();
        arch_path.reverse();
        arch_path.push(node.value);
        arch_path.extend(r_path.clone());

        *global_path = arch_path;
    }

    if l_sum > r_sum {
        let mut ret_path = vec![node.value];
        ret_path.extend(l_path);
        (node.value + l_sum, ret_path)
    } else {
        let mut ret_path = vec![node.value];
        ret_path.extend(r_path);
        (node.value + r_sum, ret_path)
    }
}

pub fn brute_force_validator(tree: &BST<i32>) -> (i32, Vec<i32>) {
    if tree.root.is_none() {
        return (0, Vec::new());
    }

    let mut graph: HashMap<i32, Vec<i32>> = HashMap::new();
    build_graph(&tree.root, &mut graph);

    if graph.is_empty() {
        let val = tree.root.as_ref().unwrap().value;
        return (val, vec![val]);
    }

    let mut best_sum = i32::MIN;
    let mut best_path = Vec::new();

    for &start_node in graph.keys() {
        let mut visited = HashSet::new();
        let mut current_path = Vec::new();

        dfs_all_paths(
            start_node,
            &graph,
            &mut visited,
            &mut current_path,
            &mut best_sum,
            &mut best_path
        );
    }

    (best_sum, best_path)
}

fn build_graph(node_opt: &Option<Box<Node<i32>>>, graph: &mut HashMap<i32, Vec<i32>>) {
    if let Some(node) = node_opt {
        graph.entry(node.value).or_insert_with(Vec::new);

        if let Some(left) = &node.left {
            graph.entry(node.value).or_insert_with(Vec::new).push(left.value);
            graph.entry(left.value).or_insert_with(Vec::new).push(node.value);
            build_graph(&node.left, graph);
        }
        if let Some(right) = &node.right {
            graph.entry(node.value).or_insert_with(Vec::new).push(right.value);
            graph.entry(right.value).or_insert_with(Vec::new).push(node.value);
            build_graph(&node.right, graph);
        }
    }
}

fn dfs_all_paths(
    current: i32,
    graph: &HashMap<i32, Vec<i32>>,
    visited: &mut HashSet<i32>,
    current_path: &mut Vec<i32>,
    best_sum: &mut i32,
    best_path: &mut Vec<i32>
) {
    visited.insert(current);
    current_path.push(current);

    let sum: i32 = current_path.iter().sum();

    if sum > *best_sum || (sum == *best_sum && best_path.is_empty()) {
        *best_sum = sum;
        *best_path = current_path.clone();
    }

    if let Some(neighbors) = graph.get(&current) {
        for &neighbor in neighbors {
            if !visited.contains(&neighbor) {
                dfs_all_paths(neighbor, graph, visited, current_path, best_sum, best_path);
            }
        }
    }

    current_path.pop();
    visited.remove(&current);
}