use std::fs;

use hw12::data::{mutated, periodic, skewed, uniform, LOWER};
use hw12::search::{prepare, reference, search, Count, Silent, Tally, METHODS};
use hw12::timing::median_seconds;
use serde_json::{json, Value};

const SIZE: usize = 1_000_000;
const PATTERN_AT: usize = 500_000;
const RUNS: usize = 7;
const SEEDS: [u64; 3] = [2026, 2027, 2028];
const LENGTHS: [usize; 3] = [5, 10, 20];

fn measure(family: &str, seed: Option<u64>, kind: &str, text: &[u8], pattern: &[u8], rows: &mut Vec<Value>) {
    let expected = reference(pattern, text).len();
    for method in METHODS {
        let mut prep_cmp = Count(0);
        let prepared = prepare(method, pattern, &mut prep_cmp).unwrap();
        let mut search_cmp = Count(0);
        let mut tally = Tally(0);
        search(&prepared, text, &mut search_cmp, &mut tally);
        assert_eq!(tally.0, expected, "{family} {kind} {}", method.name());
        let (search_time, count) = median_seconds(RUNS, || {
            let mut t = Tally(0);
            search(&prepared, std::hint::black_box(text), &mut Silent, &mut t);
            t.0
        });
        assert_eq!(count, expected);
        let per_char = search_cmp.0 as f64 / text.len() as f64;
        println!("{:>13} {:>5} {:>6} {:>9} {:>3} {:>8} {:>5} {:>11} {:>8.3} {:>9.3}", family, seed.map_or("-".into(), |s| s.to_string()),
                 kind, method.name(), pattern.len(), count, prep_cmp.0, search_cmp.0, per_char, search_time * 1e3);
        rows.push(json!({
            "family": family, "seed": seed, "pattern_kind": kind, "pattern": String::from_utf8_lossy(pattern),
            "method": method.name(), "m": pattern.len(), "matches": count, "prep_comparisons": prep_cmp.0,
            "search_comparisons": search_cmp.0, "comparisons_per_char": per_char, "search_ms": search_time * 1e3,
        }));
    }
}

fn from_text(family: &str, seed: u64, text: &[u8], rows: &mut Vec<Value>) {
    for m in LENGTHS {
        measure(family, Some(seed), "text", text, &text[PATTERN_AT..PATTERN_AT + m], rows);
    }
}

fn main() {
    fs::create_dir_all("t2").unwrap();
    let mut rows = Vec::new();
    println!("{:>13} {:>5} {:>6} {:>9} {:>3} {:>8} {:>5} {:>11} {:>8} {:>9}", "family", "seed", "kind", "method", "m", "matches", "prep", "search cmp", "cmp/char", "ms");
    for seed in SEEDS {
        from_text("binary", seed, &uniform(SIZE, b"ab", seed), &mut rows);
        from_text("dna", seed, &uniform(SIZE, b"acgt", seed), &mut rows);
        from_text("skewed", seed, &skewed(SIZE, LOWER, b'e', 500, seed), &mut rows);
        let near = mutated(SIZE, b'a', b'b', 10, seed);
        for m in LENGTHS {
            let mut tail = vec![b'a'; m - 1];
            tail.push(b'b');
            let mut head = vec![b'b'];
            head.extend(vec![b'a'; m - 1]);
            measure("near-periodic", Some(seed), "a..ab", &near, &tail, &mut rows);
            measure("near-periodic", Some(seed), "ba..a", &near, &head, &mut rows);
        }
    }
    let flat = periodic(SIZE, b"a");
    for m in LENGTHS {
        measure("periodic", None, "a^m", &flat, &vec![b'a'; m], &mut rows);
    }
    let result = json!({
        "size": SIZE, "runs": RUNS, "seeds": SEEDS, "pattern_position": PATTERN_AT,
        "families": {
            "binary": "uniform over {a,b}; patterns text[500000..500000+m]",
            "dna": "uniform over {a,c,g,t}; patterns text[500000..500000+m]",
            "skewed": "26 letters, 'e' with probability 0.5, other 25 letters uniform; patterns text[500000..500000+m]",
            "near-periodic": "'a' with 'b' at probability 0.01 per position; patterns a^(m-1)b and b a^(m-1)",
            "periodic": "a^n, pattern a^m, no randomness",
        },
        "rows": rows,
    });
    fs::write("t2/T2.json", serde_json::to_string_pretty(&result).unwrap()).unwrap();
}
