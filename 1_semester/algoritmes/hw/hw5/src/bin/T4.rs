use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{self, BufRead};
use std::time::Instant;

struct BloomFilter {
    bits: Vec<u8>,
}

impl BloomFilter {
    fn new() -> Self {
        BloomFilter {
            bits: vec![0; 12500],
        }
    }

    fn set(&mut self, pos: u64) {
        let p = pos as usize;
        self.bits[p / 8] |= 1 << (p % 8);
    }

    fn test(&self, pos: u64) -> bool {
        let p = pos as usize;
        (self.bits[p / 8] & (1 << (p % 8))) != 0
    }
}

fn fnv1a_hash(data: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for &b in data {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x100000001b3); // Простое число FNV (prime)
    }
    hash
}

fn sha256_hash(data: &[u8]) -> u64 {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut buf = [0u8; 8];
    buf.copy_from_slice(&result[0..8]);
    u64::from_be_bytes(buf) // Извлекаем первые 8 байт как big-endian unsigned
}

fn check_word<F>(word: &str, hash_fn: F, filter: &BloomFilter) -> (bool, [u64; 7])
where
    F: Fn(&[u8]) -> u64,
{
    let mut positions = [0; 7];
    let bytes = word.as_bytes();

    for i in 0..7 {
        let mut data = Vec::with_capacity(2 + bytes.len());
        data.push(i as u8);
        data.push(0u8);
        data.extend_from_slice(bytes);
        positions[i] = hash_fn(&data) % 100000;
    }

    let mut found = true;
    for &p in &positions {
        if !filter.test(p) {
            found = false;
        }
    }
    (found, positions)
}

fn run_experiment<F>(
    name: &str,
    hash_fn: F,
    insert_words: &[String],
    absent_words: &[String],
) where
    F: Fn(&[u8]) -> u64 + Copy,
{
    let mut filter = BloomFilter::new();

    // Вставка
    for word in insert_words {
        let bytes = word.as_bytes();
        for i in 0..7 {
            let mut data = Vec::with_capacity(2 + bytes.len());
            data.push(i as u8);
            data.push(0u8);
            data.extend_from_slice(bytes);
            let p = hash_fn(&data) % 100000;
            filter.set(p);
        }
    }

    let mut false_negatives = 0;
    for word in insert_words {
        let (found, _) = check_word(word, hash_fn, &filter);
        if !found {
            false_negatives += 1;
        }
    }

    let mut fp_count = 0;
    let mut example_fp = String::new();
    let mut example_pos = [0; 7];
    let mut times = Vec::new();

    for run in 0..3 {
        fp_count = 0;
        let start = Instant::now();
        for word in absent_words {
            let (found, pos) = check_word(word, hash_fn, &filter);
            if found {
                fp_count += 1;
                if example_fp.is_empty() {
                    example_fp = word.clone();
                    example_pos = pos;
                }
            }
        }
        times.push(start.elapsed().as_secs_f64());
    }

    times.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let median_time = times[1];
    let lookups_per_sec = absent_words.len() as f64 / median_time;
    let fp_rate = fp_count as f64 / absent_words.len() as f64;
    let ideal_rate = (1.0 - (-7.0 * 10000.0 / 100000.0_f64).exp()).powi(7);

    println!("\n=== Results for {} ===", name);
    println!("No False Negatives Check: {}", if false_negatives == 0 { "PASSED (0 FNs)" } else { "FAILED" });
    println!("| Hash | Predicted Rate | Observed Rate (Count) | Lookups/sec |");
    println!("|---|---|---|---|");
    println!("| {} | {:.5} | {:.5} ({}/50000) | {:.0} |", name, ideal_rate, fp_rate, fp_count, lookups_per_sec);

    if !example_fp.is_empty() {
        println!("Example False Positive: '{}' at positions {:?}", example_fp, example_pos);
    } else {
        println!("Example False Positive: None found!");
    }
}

fn main() -> io::Result<()> {
    println!("SHA-256 control check for 'algorithm':");
    let test_word = b"algorithm";
    for i in 0..3 {
        let mut data = vec![i as u8, 0u8];
        data.extend_from_slice(test_word);
        let h = sha256_hash(&data) % 100000;
        println!("i={}: position = {}", i, h);
    }

    let file = File::open("HW5_words.txt").expect("Файл words.txt не найден!");
    let lines: Vec<String> = io::BufReader::new(file)
        .lines()
        .filter_map(Result::ok)
        .map(|s| s.trim().to_string())
        .collect();

    assert!(lines.len() >= 60000, "Need at least 60,000 words");
    let insert_words = &lines[0..10000];
    let absent_words = &lines[10000..60000];

    run_experiment("FNV-1a (Custom)", fnv1a_hash, insert_words, absent_words);
    run_experiment("SHA-256 (Library)", sha256_hash, insert_words, absent_words);

    Ok(())
}