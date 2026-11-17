use std::fs;

use hw12::bwt::{decode, encode, encode_naive, ranks, rotation, rotations, run_lengths, runs};
use hw12::data::{uniform, Rng};
use hw12::sa::suffix_array;
use serde_json::{json, Value};

const MAIN: &[u8] = b"bananabananabandanas$";
const OWN: &[u8] = b"lollipoplollipoplol$";

fn show(s: &[u8]) -> String {
    String::from_utf8_lossy(s).to_string()
}

fn analyse(text: &[u8], report: &mut Vec<String>, table: bool) -> Value {
    let n = text.len();
    let rows = rotations(text);
    let sa = suffix_array(text);
    assert_eq!(rows.iter().map(|&i| i as u32).collect::<Vec<_>>(), sa);
    let bwt = encode(text);
    assert_eq!(bwt, encode_naive(text));
    let (rank, _) = ranks(&bwt);
    report.push(format!("text {} (n = {n})", show(text)));
    let mut rotation_rows = Vec::new();
    if table {
        report.push(format!("{:>3} {:>3}  F | {:<w$} | L   rank of L among equal letters", "row", "SA", "middle", w = n - 2));
    }
    for (r, &i) in rows.iter().enumerate() {
        let rot = rotation(text, i);
        if table {
            report.push(format!("{r:>3} {i:>3}  {} | {} | {}   {}{}", rot[0] as char, show(&rot[1..n - 1]), rot[n - 1] as char,
                rank[r], if i == 0 { "   <- original text" } else { "" }));
        }
        rotation_rows.push(json!({"row": r, "start": i, "rotation": show(&rot), "original": i == 0, "rank": rank[r]}));
    }
    let first: Vec<u8> = rows.iter().map(|&i| text[i]).collect();
    report.push(format!("F   = {}", show(&first)));
    report.push(format!("BWT = {}   (L column; equal to text[SA[i] - 1], with the $ row wrapping around)", show(&bwt)));
    let (decoded, steps) = decode(&bwt, b'$');
    assert_eq!(decoded, text);
    let fmt = |s: &[u8]| run_lengths(s).iter().map(|&(c, k)| format!("{}{k}", c as char)).collect::<Vec<_>>().join(" ");
    let longest = |s: &[u8]| run_lengths(s).iter().map(|r| r.1).max().unwrap();
    report.push(format!("runs: text {} (longest {}) -> BWT {} (longest {})", runs(text), longest(text), runs(&bwt), longest(&bwt)));
    report.push(format!("  text runs: {}", fmt(text)));
    report.push(format!("  BWT runs:  {}", fmt(&bwt)));
    report.push("decoding with the LF mapping: start in row 0 (the rotation that begins with $), read L[row],".into());
    report.push("the k-th copy of a letter in L is the k-th copy of it in F, so next row = first row of that letter in F + k".into());
    let mut decode_rows = Vec::new();
    for (k, s) in steps.iter().enumerate() {
        report.push(format!("  step {:>2}: row {:>2}, L = '{}' (copy #{} of it in L) -> row {:>2}; text so far {}", k + 1, s.row, s.letter as char, s.rank, s.next, show(&s.known)));
        decode_rows.push(json!({"step": k + 1, "row": s.row, "letter": (s.letter as char).to_string(), "rank": s.rank, "next": s.next, "known": show(&s.known)}));
    }
    report.push(format!("decoded {} == original: {}", show(&decoded), decoded == text));
    json!({"text": show(text), "suffix_array": sa, "first": show(&first), "bwt": show(&bwt),
           "runs_text": runs(text), "runs_bwt": runs(&bwt), "rotations": rotation_rows, "decode": decode_rows})
}

fn main() {
    fs::create_dir_all("t5").unwrap();
    let mut rng = Rng::new(3);
    for round in 0..2000 {
        let mut text = uniform(rng.below(40) as usize, if round % 2 == 0 { b"ab" } else { b"acgt" }, 70 + round);
        text.push(b'$');
        let bwt = encode(&text);
        assert_eq!(bwt, encode_naive(&text));
        assert_eq!(decode(&bwt, b'$').0, text);
    }
    let mut report = vec!["self-check: 2000 random texts with $: suffix-array BWT equals sorted-rotation BWT and decodes back".to_string(), String::new()];
    let main = analyse(MAIN, &mut report, true);
    report.push(String::new());
    let own = analyse(OWN, &mut report, true);
    report.push(String::new());
    let mut no_end = b"banana".to_vec();
    let a = encode_naive(&no_end);
    no_end.rotate_left(1);
    let b = encode_naive(&no_end);
    report.push(format!("without $: BWT(banana) = {} and BWT(ananab) = {} are equal, so the start row cannot be recovered", show(&a), show(&b)));
    let text = report.join("\n");
    println!("{text}");
    fs::write("t5/T5.txt", &text).unwrap();
    fs::write("t5/T5.json", serde_json::to_string_pretty(&json!({"main": main, "own": own,
        "without_end_marker": {"banana": show(&a), "ananab": show(&b)}})).unwrap()).unwrap();
}
