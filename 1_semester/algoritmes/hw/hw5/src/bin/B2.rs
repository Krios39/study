use std::fs::File;
use std::io::{self, BufRead};

fn value(c: char) -> u64 {
    (c as u64) - ('a' as u64) + 1
}

fn weak_hash(word: &str, m: u64) -> u64 {
    word.chars().map(value).sum::<u64>() % m
}

fn affine_hash(word: &str, m: u64) -> u64 {
    let mut x: u64 = 0;
    for c in word.chars() {
        x = 27 * x + value(c);
    }
    ((594481665 * x + 1171842593) % 2147483647) % m
}

struct HashTable {
    table: Vec<Option<String>>,
    m: usize,
}

impl HashTable {
    fn new(m: usize) -> Self {
        HashTable { table: vec![None; m], m }
    }

    fn locate<F>(&self, word: &str, hash_fn: F) -> (Option<usize>, u64)
    where
        F: Fn(&str, u64) -> u64,
    {
        let h = hash_fn(word, self.m as u64) as usize;
        for i in 0..self.m {
5            let offset = (i * (i + 1)) / 2;
            let slot = (h + offset) % self.m;

            match &self.table[slot] {
                None => return (Some(slot), (i + 1) as u64),
                Some(w) if w == word => return (Some(slot), (i + 1) as u64),
                _ => continue,
            }
        }
        (None, self.m as u64)
    }

    fn insert<F>(&mut self, word: &str, hash_fn: F) -> bool
    where
        F: Fn(&str, u64) -> u64,
    {
        let (slot_opt, _) = self.locate(word, hash_fn);
        if let Some(slot) = slot_opt {
            if self.table[slot].is_none() {
                self.table[slot] = Some(word.to_string());
            }
            true
        } else {
            false
        }
    }
}

fn run_experiment<F>(hash_name: &str, n: usize, m: usize, insertion_order: &[String], absent_queries: &[String], hash_fn: F)
where
    F: Fn(&str, u64) -> u64 + Copy,
{
    let mut ht = HashTable::new(m);

    for i in 0..n {
        ht.insert(&insertion_order[i], hash_fn);
    }

    let mut present_probes = 0;
    for i in 0..n {
        let (_, p) = ht.locate(&insertion_order[i], hash_fn);
        present_probes += p;
    }
    let mean_present = present_probes as f64 / n as f64;

    let mut absent_probes = 0;
    for q in absent_queries {
        let (_, p) = ht.locate(q, hash_fn);
        absent_probes += p;
    }
    let mean_absent = absent_probes as f64 / absent_queries.len() as f64;

    let load = format!("{}/{} ({:.0}%)", n, m, (n as f64 / m as f64) * 100.0);
    println!("| Triangular | {:<10} | {:<15} | {:<20.2} | {:<20.2} |", hash_name, load, mean_present, mean_absent);
}

fn main() -> io::Result<()> {
    let test_hash = affine_hash("abcde", 8192);
    assert_eq!(test_hash, 1680, "Affine math is wrong!");

    let file_path = "HW5_words.txt";
    let mut short_words = Vec::new();

    let file = File::open(file_path)?;
    let lines = io::BufReader::new(file).lines();

    for line in lines.map_while(Result::ok) {
        let w = line.trim();
        if w.chars().count() <= 6 {
            short_words.push(w.to_string());
        }
    }

    let insertion_order: Vec<String> = short_words.iter().step_by(2).cloned().collect();
    let absent_candidates: Vec<String> = short_words.iter().skip(1).step_by(2).cloned().collect();
    let absent_queries: Vec<String> = absent_candidates.into_iter().take(1000).collect();

    println!("| Probing    | {:<10} | {:<15} | {:<20} | {:<20} |", "Hash", "Load", "Mean Present", "Mean Absent");
    println!("|------------|------------|-----------------|----------------------|----------------------|");

    let m = 8192;
    run_experiment("Weak", 4096, m, &insertion_order, &absent_queries, weak_hash);
    run_experiment("Weak", 7373, m, &insertion_order, &absent_queries, weak_hash);
    run_experiment("Affine", 4096, m, &insertion_order, &absent_queries, affine_hash);
    run_experiment("Affine", 7373, m, &insertion_order, &absent_queries, affine_hash);

    Ok(())
}