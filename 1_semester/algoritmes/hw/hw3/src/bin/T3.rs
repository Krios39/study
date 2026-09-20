use hw3::bst::{BST, TreeAnalyzer};
use hw3::avl::AVLTree;
use hw3::collatz::collatz_conjecture;


fn main() {
    let full_sequence = collatz_conjecture(59);
    let prefix: Vec<i32> = full_sequence.iter().take(14).copied().collect();

    println!("===========================================================");
    println!("=== 1. AVL INSERTION TRACE (14-VALUE PREFIX) ===");
    println!("===========================================================\n");

    let mut avl_14 = AVLTree::new();
    for &val in &prefix {
        avl_14.insert_with_trace(val, false); // false = печатать трейс в консоль
    }

    println!("===========================================================");
    println!("=== 2. COMPARISON: AVL vs BST (14-VALUE PREFIX) ===");
    println!("===========================================================\n");

    let bst_14 = BST::from_vec(prefix.clone());
    let analyzer_14 = TreeAnalyzer::new(&bst_14);

    println!("Ordinary BST (14 nodes):");
    println!("  Height: {}", analyzer_14.height());
    println!("  Mean Search Depth: {:.3}\n", analyzer_14.mean_search_depth());

    println!("AVL Tree (14 nodes):");
    println!("  Height: {}", avl_14.root.as_ref().unwrap().height);
    println!("  Mean Search Depth: {:.3}\n", avl_14.mean_search_depth());


    println!("===========================================================");
    println!("=== 3. FULL COLLATZ SEQUENCE (33 NODES) RUN ===");
    println!("===========================================================\n");

    let bst_full = BST::from_vec(full_sequence.clone());
    let analyzer_full = TreeAnalyzer::new(&bst_full);

    let mut avl_full = AVLTree::new();
    for &val in &full_sequence {
        avl_full.insert_with_trace(val, true); // true = silent, не печатать трейс каждого узла
    }

    println!("Ordinary BST (33 nodes):");
    println!("  Final Height: {}", analyzer_full.height());
    println!("  Mean Search Depth: {:.3}\n", analyzer_full.mean_search_depth());

    println!("AVL Tree (33 nodes):");
    println!("  Final Height: {}", avl_full.root.as_ref().unwrap().height);
    println!("  Mean Search Depth: {:.3}", avl_full.mean_search_depth());
    println!("  Rebalancing events: LL: {}, RR: {}, LR: {}, RL: {}",
             avl_full.ll_count, avl_full.rr_count, avl_full.lr_count, avl_full.rl_count);
    println!("  Total Single Rotations: {}", avl_full.get_total_rotations());
}
