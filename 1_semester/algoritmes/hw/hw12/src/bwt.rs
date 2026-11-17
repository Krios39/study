use crate::sa::suffix_array;

pub fn rotations(text: &[u8]) -> Vec<usize> {
    let n = text.len();
    let mut rows: Vec<usize> = (0..n).collect();
    rows.sort_by_key(|&i| [&text[i..], &text[..i]].concat());
    rows
}

pub fn rotation(text: &[u8], i: usize) -> Vec<u8> {
    [&text[i..], &text[..i]].concat()
}

pub fn encode_naive(text: &[u8]) -> Vec<u8> {
    rotations(text).iter().map(|&i| *rotation(text, i).last().unwrap()).collect()
}

pub fn encode(text: &[u8]) -> Vec<u8> {
    let n = text.len();
    suffix_array(text).iter().map(|&i| text[(i as usize + n - 1) % n]).collect()
}

pub fn ranks(last: &[u8]) -> (Vec<usize>, [usize; 256]) {
    let mut seen = [0usize; 256];
    let rank = last
        .iter()
        .map(|&c| {
            seen[c as usize] += 1;
            seen[c as usize] - 1
        })
        .collect();
    let mut first = [0usize; 256];
    let mut total = 0;
    for c in 0..256 {
        first[c] = total;
        total += seen[c];
    }
    (rank, first)
}

pub struct Step {
    pub row: usize,
    pub letter: u8,
    pub rank: usize,
    pub next: usize,
    pub known: Vec<u8>,
}

pub fn decode(last: &[u8], end: u8) -> (Vec<u8>, Vec<Step>) {
    let (rank, first) = ranks(last);
    let n = last.len();
    assert_eq!(last.iter().filter(|&&c| c == end).count(), 1);
    let mut row = 0;
    let mut out = vec![end];
    let mut steps = Vec::new();
    for _ in 1..n {
        let c = last[row];
        let next = first[c as usize] + rank[row];
        out.insert(0, c);
        steps.push(Step { row, letter: c, rank: rank[row], next, known: out.clone() });
        row = next;
    }
    (out, steps)
}

pub fn runs(s: &[u8]) -> usize {
    if s.is_empty() { 0 } else { 1 + s.windows(2).filter(|w| w[0] != w[1]).count() }
}

pub fn run_lengths(s: &[u8]) -> Vec<(u8, usize)> {
    let mut out: Vec<(u8, usize)> = Vec::new();
    for &c in s {
        match out.last_mut() {
            Some((x, k)) if *x == c => *k += 1,
            _ => out.push((c, 1)),
        }
    }
    out
}
