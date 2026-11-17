use std::fs;

use hw12::data::{uniform, LOWER, Rng};
use hw12::search::{horspool_trace, positions, prepare, reference, search, Count, Silent, Tally, METHODS};
use hw12::timing::median_seconds;
use serde_json::json;

const SEED: u64 = 2026;
const SIZE: usize = 1_000_000;
const PATTERN_AT: usize = 500_000;
const RUNS: usize = 7;
const PREP_REPEAT: usize = 10_000;

fn small_tests() -> Vec<serde_json::Value> {
    let cases: [(&str, &str, &str, &[usize]); 9] = [
        ("overlapping matches", "abababa", "aba", &[0, 2, 4]),
        ("overlapping, one letter", "aaaaa", "aa", &[0, 1, 2, 3]),
        ("no match", "abcdef", "xyz", &[]),
        ("matches at both ends", "abcab", "ab", &[0, 3]),
        ("pattern longer than text", "ab", "abc", &[]),
        ("pattern equals text", "abc", "abc", &[0]),
        ("prefix repeats inside pattern", "aabaabaaab", "aab", &[0, 3, 7]),
        ("classic", "abracadabra", "abra", &[0, 7]),
        ("single letter", "banana", "a", &[1, 3, 5]),
    ];
    let mut out = Vec::new();
    for (name, text, pattern, expected) in cases {
        for method in METHODS {
            let got = positions(method, pattern.as_bytes(), text.as_bytes()).unwrap();
            assert_eq!(got, expected, "{name} {}", method.name());
        }
        println!("ok  {name:32} text {text:12} pattern {pattern:5} -> {expected:?}");
        out.push(json!({"case": name, "text": text, "pattern": pattern, "expected": expected}));
    }
    for method in METHODS {
        assert!(positions(method, b"", b"abc").is_err());
    }
    println!("ok  empty pattern rejected by all three methods");
    let mut rng = Rng::new(7);
    for round in 0..3000 {
        let text = uniform(rng.below(40) as usize, b"ab", 1000 + round);
        let pattern = uniform(1 + rng.below(6) as usize, b"ab", 9000 + round);
        let expected = reference(&pattern, &text);
        for method in METHODS {
            assert_eq!(positions(method, &pattern, &text).unwrap(), expected);
        }
    }
    println!("ok  3000 random texts over {{a, b}} agree with a slice-window reference");
    out
}

fn main() {
    fs::create_dir_all("t1").unwrap();
    let tests = small_tests();
    let trace = horspool_trace(b"abra", b"abracadabra");
    println!("\nHorspool trace:");
    for line in &trace {
        println!("{line}");
    }

    let text = uniform(SIZE, LOWER, SEED);
    let mut rows = Vec::new();
    println!("\n{:>9} {:>3} {:>7} {:>10} {:>12} {:>12} {:>11} {:>7}", "method", "m", "matches", "prep cmp", "prep ns", "search cmp", "search ms", "cmp/char");
    for m in [5usize, 10, 20] {
        let pattern = &text[PATTERN_AT..PATTERN_AT + m];
        let expected = reference(pattern, &text);
        for method in METHODS {
            assert_eq!(positions(method, pattern, &text).unwrap(), expected);
            let mut prep_cmp = Count(0);
            let prepared = prepare(method, pattern, &mut prep_cmp).unwrap();
            let mut search_cmp = Count(0);
            let mut tally = Tally(0);
            search(&prepared, &text, &mut search_cmp, &mut tally);
            let (prep_time, _) = median_seconds(RUNS, || {
                let mut total = 0;
                for _ in 0..PREP_REPEAT {
                    total += std::hint::black_box(prepare(method, std::hint::black_box(pattern), &mut Silent).unwrap()).fail.len();
                }
                total
            });
            let (search_time, count) = median_seconds(RUNS, || {
                let mut t = Tally(0);
                search(&prepared, std::hint::black_box(&text), &mut Silent, &mut t);
                t.0
            });
            assert_eq!(count, expected.len());
            let prep_ns = prep_time / PREP_REPEAT as f64 * 1e9;
            println!("{:>9} {:>3} {:>7} {:>10} {:>12.1} {:>12} {:>11.3} {:>7.3}", method.name(), m, count, prep_cmp.0, prep_ns,
                     search_cmp.0, search_time * 1e3, search_cmp.0 as f64 / SIZE as f64);
            rows.push(json!({
                "method": method.name(), "m": m, "pattern": String::from_utf8_lossy(pattern), "matches": count,
                "prep_comparisons": prep_cmp.0, "prep_ns": prep_ns,
                "search_comparisons": search_cmp.0, "search_ms": search_time * 1e3,
            }));
        }
    }
    let result = json!({
        "seed": SEED, "size": SIZE, "alphabet": "a-z", "pattern_position": PATTERN_AT, "runs": RUNS,
        "prep_repeat": PREP_REPEAT, "tests": tests, "trace": trace, "rows": rows,
    });
    fs::write("t1/T1.json", serde_json::to_string_pretty(&result).unwrap()).unwrap();
}
