use std::fs;
use std::process::Command;
use std::time::Instant;

use hw12::data::{periodic, uniform, LOWER};
use hw12::search::{prepare, search, First, Silent, METHODS};
use hw12::timing::median_seconds;
use serde_json::{json, Value};

const SIZE: usize = 1_000_000;
const SEED: u64 = 2026;
const RUNS: usize = 7;

fn first(text: &[u8], pattern: &[u8]) -> Option<usize> {
    text.windows(pattern.len()).position(|w| w == pattern)
}

fn grep_run(grep: &str, pattern: &[u8], file: &str) -> (f64, bool) {
    let mut times = Vec::new();
    let mut found = false;
    for _ in 0..RUNS {
        let start = Instant::now();
        let status = Command::new(grep).arg("-F").arg("-q").arg(String::from_utf8_lossy(pattern).as_ref()).arg(file).status().unwrap();
        times.push(start.elapsed().as_secs_f64());
        found = match status.code() {
            Some(0) => true,
            Some(1) => false,
            other => panic!("grep failed: {other:?}"),
        };
    }
    times.sort_by(|a, b| a.partial_cmp(b).unwrap());
    (times[RUNS / 2], found)
}

fn main() {
    let grep = std::env::args().nth(1).unwrap_or_else(|| "grep".into());
    let version = String::from_utf8(Command::new(&grep).arg("--version").output().unwrap().stdout).unwrap();
    let version = version.lines().next().unwrap().to_string();
    fs::create_dir_all("t2/grep").unwrap();
    fs::write("t2/grep/empty.txt", b"").unwrap();
    let (startup, _) = grep_run(&grep, b"x", "t2/grep/empty.txt");
    println!("{version}; startup on an empty file {:.2} ms", startup * 1e3);

    let letters = uniform(SIZE, LOWER, SEED);
    let flat = periodic(SIZE, b"a");
    let tail = letters[SIZE - 20..].to_vec();
    let cases: Vec<(&str, &str, Vec<u8>, Vec<u8>)> = vec![
        ("letters", "absent", letters.clone(), b"qqqqqzzzzz".to_vec()),
        ("letters", "absent", letters.clone(), b"zyxwvutsrqponmlkjihg".to_vec()),
        ("letters", "near end", letters.clone(), tail),
        ("letters", "near start", letters.clone(), letters[1000..1010].to_vec()),
        ("periodic", "absent", flat.clone(), [vec![b'a'; 19], vec![b'b']].concat()),
        ("periodic", "absent", flat.clone(), [vec![b'b'], vec![b'a'; 19]].concat()),
    ];

    let mut rows: Vec<Value> = Vec::new();
    println!("\n{:>9} {:>10} {:>22} {:>8} {:>9} {:>9} {:>9} {:>9} {:>9}", "text", "kind", "pattern", "first", "naive", "KMP", "Horspool", "read ms", "grep ms");
    for (name, kind, text, pattern) in cases {
        let file = format!("t2/grep/{name}.txt");
        fs::write(&file, &text).unwrap();
        let expected = first(&text, &pattern);
        let mut times = Vec::new();
        for method in METHODS {
            let prepared = prepare(method, &pattern, &mut Silent).unwrap();
            let mut sink = First(None);
            search(&prepared, &text, &mut Silent, &mut sink);
            assert_eq!(sink.0, expected, "{} {name}", method.name());
            let (t, _) = median_seconds(RUNS, || {
                let mut s = First(None);
                search(&prepared, std::hint::black_box(&text), &mut Silent, &mut s);
                s.0.map_or(0, |p| p + 1)
            });
            times.push(t * 1e3);
        }
        let (read, _) = median_seconds(RUNS, || fs::read(&file).unwrap().len());
        let (grep_time, found) = grep_run(&grep, &pattern, &file);
        assert_eq!(found, expected.is_some(), "grep disagrees on {name}");
        let shown = String::from_utf8_lossy(&pattern).to_string();
        println!("{:>9} {:>10} {:>22} {:>8} {:>9.3} {:>9.3} {:>9.3} {:>9.3} {:>9.2}", name, kind, shown,
                 expected.map_or("-".into(), |p| p.to_string()), times[0], times[1], times[2], read * 1e3, grep_time * 1e3);
        rows.push(json!({
            "text": name, "kind": kind, "pattern": shown, "first_match": expected, "found": found,
            "naive_ms": times[0], "kmp_ms": times[1], "horspool_ms": times[2], "file_read_ms": read * 1e3, "grep_ms": grep_time * 1e3,
        }));
    }
    let result = json!({
        "grep_version": version, "command": "grep -F -q PATTERN FILE", "runs": RUNS, "size": SIZE, "seed": SEED,
        "grep_startup_empty_file_ms": startup * 1e3,
        "note": "grep time is wall-clock of the whole process: start-up, file reading and search; our times are search only on text already in memory, file_read_ms is reported separately",
        "rows": rows,
    });
    fs::write("t2/T2_grep.json", serde_json::to_string_pretty(&result).unwrap()).unwrap();
}
