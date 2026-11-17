use std::fs;
use std::time::Instant;

use hw12::data::{uniform, Rng, LOWER};
use hw12::sa::{interval, suffix_array, trace};
use hw12::search::{prepare, reference, search, Count, Method, Silent, Tally, METHODS};
use hw12::suffix::{leaves, tree, tree_walk, trie};
use hw12::timing::median_seconds;
use serde_json::{json, Value};

const SMALL: &[u8] = b"bananabananabandanas$";
const SIZE: usize = 1_000_000;
const SEED: u64 = 2026;
const RUNS: usize = 7;
const QUERIES: usize = 50;

fn small(report: &mut Vec<String>) -> Value {
    let sa = suffix_array(SMALL);
    let mut naive: Vec<u32> = (0..SMALL.len() as u32).collect();
    naive.sort_by_key(|&i| &SMALL[i as usize..]);
    assert_eq!(sa, naive);
    report.push(format!("suffix array of {}", String::from_utf8_lossy(SMALL)));
    report.push(format!("{:>4} {:>4}  suffix", "rank", "SA"));
    for (r, &i) in sa.iter().enumerate() {
        report.push(format!("{r:>4} {i:>4}  {}", String::from_utf8_lossy(&SMALL[i as usize..])));
    }
    let s = tree(&trie(SMALL));
    let mut out = Vec::new();
    for pattern in ["ana", "band", "nabx"] {
        let p = pattern.as_bytes();
        let mut c = Count(0);
        let (lo, hi) = interval(SMALL, &sa, p, &mut c);
        let mut starts: Vec<usize> = sa[lo..hi].iter().map(|&x| x as usize).collect();
        starts.sort();
        let walk = tree_walk(&s, SMALL, p);
        let from_tree = walk.locus.map(|v| leaves(v, &s.leaf, |u| s.children[u].clone())).unwrap_or_default();
        assert_eq!(starts, from_tree);
        assert_eq!(starts, reference(p, SMALL));
        report.push(String::new());
        report.push(format!("pattern {pattern}: interval [{lo}, {hi}) of size {}, SA values {:?}, sorted {starts:?}, same as the suffix tree leaves; {} character comparisons",
            hi - lo, &sa[lo..hi], c.0));
        report.push("  lower bound: first rank whose suffix is not smaller than the pattern".into());
        report.extend(trace(SMALL, &sa, p, false).into_iter().map(|x| format!("    {x}")));
        report.push("  upper bound: first rank whose suffix is greater than the pattern (prefix of length m compared)".into());
        report.extend(trace(SMALL, &sa, p, true).into_iter().map(|x| format!("    {x}")));
        out.push(json!({"pattern": pattern, "lo": lo, "hi": hi, "positions": starts, "comparisons": c.0}));
    }
    json!({"suffix_array": sa, "searches": out})
}

fn self_check() {
    let mut rng = Rng::new(11);
    for round in 0..2000 {
        let text = uniform(1 + rng.below(60) as usize, if round % 2 == 0 { b"ab" } else { b"abc" }, 500 + round);
        let sa = suffix_array(&text);
        let mut naive: Vec<u32> = (0..text.len() as u32).collect();
        naive.sort_by_key(|&i| &text[i as usize..]);
        assert_eq!(sa, naive);
        let pattern = uniform(1 + rng.below(4) as usize, b"ab", 900 + round);
        let (lo, hi) = interval(&text, &sa, &pattern, &mut Silent);
        let mut got: Vec<usize> = sa[lo..hi].iter().map(|&x| x as usize).collect();
        got.sort();
        assert_eq!(got, reference(&pattern, &text));
    }
    let flat = vec![b'a'; 5000];
    let sa = suffix_array(&flat);
    assert!(sa.iter().enumerate().all(|(r, &i)| i as usize == flat.len() - 1 - r));
}

fn scan_count(method: Method, pattern: &[u8], text: &[u8]) -> usize {
    let p = prepare(method, pattern, &mut Silent).unwrap();
    let mut t = Tally(0);
    search(&p, text, &mut Silent, &mut t);
    t.0
}

fn horspool_count(pattern: &[u8], text: &[u8]) -> usize {
    scan_count(Method::Horspool, pattern, text)
}

fn large(name: &str, text: &[u8], report: &mut Vec<String>) -> Value {
    let n = text.len();
    let start = Instant::now();
    let sa = suffix_array(text);
    let build = start.elapsed().as_secs_f64();
    let builds: Vec<f64> = (0..2).map(|_| { let s = Instant::now(); std::hint::black_box(suffix_array(text)); s.elapsed().as_secs_f64() }).collect();
    let mut all = vec![build, builds[0], builds[1]];
    all.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let build = all[1];
    assert!(sa.windows(2).all(|w| text[w[0] as usize..] < text[w[1] as usize..]));
    let index_bytes = sa.len() * 4;
    let peak_bytes = n * 4 * 3;
    report.push(String::new());
    report.push(format!("{name}: n = {n}, construction {:.1} ms (median of 3), suffix array {index_bytes} bytes (u32 per suffix) plus the text {n} bytes, construction working memory about {peak_bytes} bytes (SA, rank, next)", build * 1e3));
    report.push(format!("{:>3} {:>8} {:>8} {:>8} {:>10} {:>10} {:>10} {:>10} {:>10} {:>10} {:>9}", "m", "avg occ", "SA cmp", "SA us",
        "naive cmp", "naive us", "KMP cmp", "KMP us", "Hors cmp", "Hors us", "k vs Hors"));
    let mut rng = Rng::new(SEED + 99);
    let mut rows = Vec::new();
    for m in [5usize, 10, 20] {
        let patterns: Vec<Vec<u8>> = (0..QUERIES).map(|_| { let at = rng.below((n - m) as u64) as usize; text[at..at + m].to_vec() }).collect();
        let mut sa_cmp = Count(0);
        let mut scan_cmp = [Count(0), Count(0), Count(0)];
        let mut occ = 0;
        for p in &patterns {
            let (lo, hi) = interval(text, &sa, p, &mut sa_cmp);
            for (k, method) in METHODS.into_iter().enumerate() {
                let prepared = prepare(method, p, &mut scan_cmp[k]).unwrap();
                let mut t = Tally(0);
                search(&prepared, text, &mut scan_cmp[k], &mut t);
                assert_eq!(hi - lo, t.0);
            }
            occ += hi - lo;
        }
        let (sa_time, _) = median_seconds(RUNS, || patterns.iter().map(|p| { let (lo, hi) = interval(std::hint::black_box(text), &sa, p, &mut Silent); hi - lo }).sum());
        let scan_q: Vec<f64> = METHODS.into_iter().map(|method| median_seconds(RUNS, || patterns.iter().map(|p| scan_count(method, p, std::hint::black_box(text))).sum()).0 / QUERIES as f64).collect();
        let q = QUERIES as f64;
        let sa_q = sa_time / q;
        let k = build / (scan_q[2] - sa_q);
        report.push(format!("{m:>3} {:>8.1} {:>8.1} {:>8.3} {:>10.0} {:>10.1} {:>10.0} {:>10.1} {:>10.0} {:>10.1} {:>9.0}", occ as f64 / q,
            sa_cmp.0 as f64 / q, sa_q * 1e6, scan_cmp[0].0 as f64 / q, scan_q[0] * 1e6, scan_cmp[1].0 as f64 / q, scan_q[1] * 1e6,
            scan_cmp[2].0 as f64 / q, scan_q[2] * 1e6, k));
        rows.push(json!({"m": m, "queries": QUERIES, "avg_occurrences": occ as f64 / q,
            "sa_comparisons_per_query": sa_cmp.0 as f64 / q, "sa_us_per_query": sa_q * 1e6,
            "naive_comparisons_per_query": scan_cmp[0].0 as f64 / q, "naive_us_per_query": scan_q[0] * 1e6,
            "kmp_comparisons_per_query": scan_cmp[1].0 as f64 / q, "kmp_us_per_query": scan_q[1] * 1e6,
            "horspool_comparisons_per_query": scan_cmp[2].0 as f64 / q, "horspool_us_per_query": scan_q[2] * 1e6,
            "crossover_queries": k}));
    }
    let k = rows[1]["crossover_queries"].as_f64().unwrap();
    let mut checks = Vec::new();
    for q in [(k / 2.0).round() as usize, (k * 2.0).round() as usize] {
        let patterns: Vec<Vec<u8>> = (0..q).map(|_| { let at = rng.below((n - 10) as u64) as usize; text[at..at + 10].to_vec() }).collect();
        let s = Instant::now();
        let index = suffix_array(text);
        let a: usize = patterns.iter().map(|p| { let (lo, hi) = interval(text, &index, p, &mut Silent); hi - lo }).sum();
        let with_index = s.elapsed().as_secs_f64();
        let s = Instant::now();
        let b: usize = patterns.iter().map(|p| horspool_count(p, text)).sum();
        let scanning = s.elapsed().as_secs_f64();
        assert_eq!(a, b);
        report.push(format!("check m = 10, {q} queries: build + queries {:.1} ms, Horspool scans {:.1} ms -> {} is faster", with_index * 1e3, scanning * 1e3,
            if with_index < scanning { "the index" } else { "scanning" }));
        checks.push(json!({"queries": q, "index_total_ms": with_index * 1e3, "scan_total_ms": scanning * 1e3}));
    }
    json!({"text": name, "n": n, "construction_ms": build * 1e3, "index_bytes": index_bytes, "text_bytes": n,
           "construction_working_bytes": peak_bytes, "rows": rows, "crossover_checks": checks})
}

fn main() {
    fs::create_dir_all("t4").unwrap();
    self_check();
    let mut report = vec!["self-check: 2000 random texts over {a,b} and {a,b,c} and a^5000 agree with sorting suffix slices; intervals agree with a scan".to_string(), String::new()];
    let small = small(&mut report);
    let letters = uniform(SIZE, LOWER, SEED);
    let dna = uniform(SIZE, b"acgt", SEED);
    let a = large("T1 text (26 letters, seed 2026)", &letters, &mut report);
    let b = large("T2 text (DNA {a,c,g,t}, seed 2026)", &dna, &mut report);
    let text = report.join("\n");
    println!("{text}");
    fs::write("t4/T4.txt", &text).unwrap();
    fs::write("t4/T4.json", serde_json::to_string_pretty(&json!({
        "constructor": "own prefix doubling (Manber-Myers style, sort by rank pairs, O(n log^2 n))",
        "runs": RUNS, "queries_per_length": QUERIES, "small": small, "large": [a, b],
    })).unwrap()).unwrap();
}
