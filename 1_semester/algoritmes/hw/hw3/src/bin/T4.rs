use hw3::bst::{BST, TreeAnalyzer};
use rand::seq::SliceRandom;
use rand::SeedableRng;
use rand::rngs::StdRng;
use std::collections::HashSet;
use hw3::collatz::collatz_conjecture;

fn main() {
    let raw_collatz = collatz_conjecture(51);
    let mut seen = HashSet::new();
    let mut original_order = Vec::new();
    for &val in &raw_collatz {
        if seen.insert(val) { original_order.push(val); }
    }

    let mut random_order = original_order.clone();
    let mut rng = StdRng::seed_from_u64(2026);
    random_order.shuffle(&mut rng);

    let mut sorted_keys = original_order.clone();
    sorted_keys.sort_unstable();
    let mut median_order = Vec::new();
    generate_median_order(&sorted_keys, &mut median_order);

    println!("=== 1. INSERTION ORDERS ===");
    println!("Original: {:?}", original_order);
    println!("Random:   {:?}", random_order);
    println!("Median:   {:?}", median_order);

    let (tree_orig, comp_orig) = build_and_count(&original_order);
    let (tree_rand, comp_rand) = build_and_count(&random_order);
    let (tree_med, comp_med) = build_and_count(&median_order);

    let a_orig = TreeAnalyzer::new(&tree_orig);
    let a_rand = TreeAnalyzer::new(&tree_rand);
    let a_med = TreeAnalyzer::new(&tree_med);

    println!("\n=== 2. CORRECTNESS CHECK (INORDER) ===");
    let in_orig = a_orig.get_inorder();
    let in_rand = a_rand.get_inorder();
    let in_med = a_med.get_inorder();
    println!("Are all inorder traversals identical to sorted keys? {}",
             in_orig == sorted_keys && in_rand == sorted_keys && in_med == sorted_keys);

    println!("\n=== 3. COMPARISON TABLE ===");
    println!("{:<12} | {:<10} | {:<12} | {:<12} | {:<12}",
             "Order", "Height", "Mean Depth", "95th %ile", "Comparisons");
    println!("{:-<70}", "");
    println!("{:<12} | {:<10} | {:<12.3} | {:<12} | {:<12}",
             "Original", a_orig.height(), a_orig.mean_search_depth(), a_orig.percentile_95_depth(), comp_orig);
    println!("{:<12} | {:<10} | {:<12.3} | {:<12} | {:<12}",
             "Random", a_rand.height(), a_rand.mean_search_depth(), a_rand.percentile_95_depth(), comp_rand);
    println!("{:<12} | {:<10} | {:<12.3} | {:<12} | {:<12}",
             "Median-1st", a_med.height(), a_med.mean_search_depth(), a_med.percentile_95_depth(), comp_med);
}

fn generate_median_order(sorted: &[i32], out: &mut Vec<i32>) {
    if sorted.is_empty() { return; }
    let mid = (sorted.len() - 1) / 2; // Берет нижнюю медиану при четной длине
    out.push(sorted[mid]);
    generate_median_order(&sorted[0..mid], out);
    generate_median_order(&sorted[mid + 1..], out);
}

fn build_and_count(keys: &[i32]) -> (BST<i32>, usize) {
    let mut tree = BST::new();
    let mut total_comparisons = 0;

    for &val in keys {
        let mut current = &tree.root;

        while let Some(node) = current {
            total_comparisons += 1; // Сравниваем с текущим узлом
            if val < node.value { current = &node.left; }
            else if val > node.value { current = &node.right; }
            else { break; } // Дубликат
        }
        tree.insert(val);
    }
    (tree, total_comparisons)
}

