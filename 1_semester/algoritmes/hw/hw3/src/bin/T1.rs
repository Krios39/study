use hw3::bst::BST;

fn main() {
    let colatz7 = collatz_conjecture(7);
    let colatz9 = collatz_conjecture(9);
    let colatz51 = collatz_conjecture(51);

    println!("colatz 7 {:?}", colatz7);
    println!("colatz 9 {:?}", colatz9);
    println!("colatz 51 {:?}", colatz51);


    let longest_colatz = longest_collatz();
    println!(" longest colatz {:?} and it {:?}", longest_colatz, collatz_conjecture(longest_colatz));

    let tree1 = BST::from_vec(colatz7);
    let tree2 = BST::from_vec(colatz9);
    let tree3 = BST::from_vec(colatz51);
    let tree4 = BST::from_vec(collatz_conjecture(longest_colatz));
}

fn collatz_conjecture(n: i32) -> Vec<i32> {
    let mut v = vec![n];
    let mut next_step = n;

    while next_step != 1 {
        if next_step % 2 == 0 {
            next_step /= 2;
        } else {
            next_step = 3 * next_step + 1;
        }
        v.push(next_step);
    }

    return v;
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
