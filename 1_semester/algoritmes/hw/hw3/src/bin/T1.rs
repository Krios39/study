
use hw3::bst::{BST, TreeAnalyzer};
use hw3::collatz::{collatz_conjecture};

fn main() {
    let colatz7 = collatz_conjecture(7);
    let colatz9 = collatz_conjecture(9);
    let colatz51 = collatz_conjecture(51);

    println!("=== 1. GIVEN SEQUENCES ===");
    println!("7: {:?}", colatz7);
    println!("9: {:?}", colatz9);
    println!("51: {:?}", colatz51);

    let tree7 = BST::from_vec(colatz7);
    let tree9 = BST::from_vec(colatz9);
    let tree51 = BST::from_vec(colatz51);

    let a7 = TreeAnalyzer::new(&tree7);
    let a9 = TreeAnalyzer::new(&tree9);
    let a51 = TreeAnalyzer::new(&tree51);

    println!("\n=== 2. COMPACT TREES ===");
    println!("Tree 7:");
    tree7.print_compact();
    println!("Tree 9:");
    tree9.print_compact();
    println!("Tree 51:");
    tree51.print_compact();

    println!("\n=== 3. SEARCH TRACE IN TREE 51 ===");
    a51.search_with_trace(&16);
    a51.search_with_trace(&100);

    println!("\n=== 4. FOURTH SEQUENCE SEARCH ===");
    let longest_start = longest_collatz();
    let colatz_longest = collatz_conjecture(longest_start);
    let tree_longest = BST::from_vec(colatz_longest.clone());
    let a_longest = TreeAnalyzer::new(&tree_longest);

    let max_reached = colatz_longest.iter().max().unwrap();

    println!("Searched interval: 4 ..= 100_004");
    println!("Selected starting value: {}", longest_start);
    println!("Sequence length: {}", colatz_longest.len());
    println!("Largest reached value: {}", max_reached);

    println!("\n=== 5. STRUCTURAL COMPARISON TABLE ===");
    println!("{:<10} | {:<10} | {:<10} | {:<15} | {:<30}", "Tree", "Node Count", "Height", "Max Width", "Depth Distribution (Successful Search)");
    println!("{:-<100}", "");
    println!("{:<10} | {:<10} | {:<10} | {:<15} | {:?}", "7", a7.count_nodes(), a7.height(), a7.max_width(), a7.depth_distribution());
    println!("{:<10} | {:<10} | {:<10} | {:<15} | {:?}", "9", a9.count_nodes(), a9.height(), a9.max_width(), a9.depth_distribution());
    println!("{:<10} | {:<10} | {:<10} | {:<15} | {:?}", "51", a51.count_nodes(), a51.height(), a51.max_width(), a51.depth_distribution());
    println!("{:<10} | {:<10} | {:<10} | {:<15} | See below", longest_start, a_longest.count_nodes(), a_longest.height(), a_longest.max_width());

    println!("\nDepth distribution for Tree {}:", longest_start);
    println!("{:?}", a_longest.depth_distribution());
}




fn longest_collatz() -> i32 {
    let mut longest_index: i32 = 0;
    let mut longest_long: i32 = 0;

    for i in 4..=100_004 {
        let collatz = collatz_conjecture(i);

        if collatz.len() > longest_long as usize{
            longest_long = collatz.len() as i32;
            longest_index = i;
        };
    }

    return longest_index;
}
