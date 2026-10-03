use std::fs::File;
use std::io::{self, BufRead};
use std::path::Path;

fn lcp(a: &str, b: &str) -> usize {
    a.chars()
        .zip(b.chars())
        .take_while(|(ca, cb)| ca == cb)
        .count()
}

fn main() -> io::Result<()> {
    let file_path = "HW5_words.txt";

    let mut n: u64 = 1;
    let mut previous = String::new();

    if let Ok(lines) = read_lines(file_path) {
        for line in lines {
            if let Ok(word) = line {
                let word = word.trim().to_string();
                let common_prefix_len = lcp(&previous, &word) as u64;
                let word_len = word.chars().count() as u64;

                n += word_len - common_prefix_len;
                previous = word;
            }
        }
    } else {
        println!("File don't found. Check the path");
        return Ok(());
    }

    println!("Full node count (N): {}", n);


    let dense_bits = 833 * n;
    let dense_bytes = (dense_bits + 7) / 8;

    let bp_bits = 8 * n - 5;
    let bp_bytes = (bp_bits + 7) / 8;

    println!("Dense Trie size: {} bytes", dense_bytes);
    println!("BP Trie size: {} bytes", bp_bytes);

    Ok(())
}

fn read_lines<P>(filename: P) -> io::Result<io::Lines<io::BufReader<File>>>
where
    P: AsRef<Path>,
{
    let file = File::open(filename)?;
    Ok(io::BufReader::new(file).lines())
}