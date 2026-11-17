use std::cmp::Ordering;

use crate::search::Counter;

pub fn suffix_array(text: &[u8]) -> Vec<u32> {
    let n = text.len();
    let mut sa: Vec<u32> = (0..n as u32).collect();
    if n < 2 {
        return sa;
    }
    let mut rank: Vec<u32> = text.iter().map(|&c| c as u32).collect();
    let mut next = vec![0u32; n];
    let mut k = 1;
    loop {
        let key = |i: u32, rank: &[u32]| -> u64 {
            let i = i as usize;
            let second = if i + k < n { rank[i + k] as u64 + 1 } else { 0 };
            ((rank[i] as u64) << 32) | second
        };
        sa.sort_unstable_by_key(|&i| key(i, &rank));
        next[sa[0] as usize] = 0;
        for j in 1..n {
            let step = (key(sa[j], &rank) != key(sa[j - 1], &rank)) as u32;
            next[sa[j] as usize] = next[sa[j - 1] as usize] + step;
        }
        std::mem::swap(&mut rank, &mut next);
        if rank[sa[n - 1] as usize] as usize == n - 1 {
            return sa;
        }
        k *= 2;
    }
}

pub fn compare<C: Counter>(text: &[u8], start: usize, pattern: &[u8], c: &mut C) -> Ordering {
    let suffix = &text[start..];
    for (j, &p) in pattern.iter().enumerate() {
        if j == suffix.len() {
            return Ordering::Less;
        }
        c.tick();
        if suffix[j] != p {
            return suffix[j].cmp(&p);
        }
    }
    Ordering::Equal
}

pub fn lower<C: Counter>(text: &[u8], sa: &[u32], pattern: &[u8], c: &mut C) -> usize {
    let (mut lo, mut hi) = (0, sa.len());
    while lo < hi {
        let mid = (lo + hi) / 2;
        if compare(text, sa[mid] as usize, pattern, c) == Ordering::Less {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    lo
}

pub fn upper<C: Counter>(text: &[u8], sa: &[u32], pattern: &[u8], c: &mut C) -> usize {
    let (mut lo, mut hi) = (0, sa.len());
    while lo < hi {
        let mid = (lo + hi) / 2;
        if compare(text, sa[mid] as usize, pattern, c) == Ordering::Greater {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    lo
}

pub fn interval<C: Counter>(text: &[u8], sa: &[u32], pattern: &[u8], c: &mut C) -> (usize, usize) {
    let lo = lower(text, sa, pattern, c);
    let hi = upper(text, sa, pattern, c);
    (lo, hi)
}

pub fn trace(text: &[u8], sa: &[u32], pattern: &[u8], upper_bound: bool) -> Vec<String> {
    let (mut lo, mut hi) = (0, sa.len());
    let mut lines = Vec::new();
    while lo < hi {
        let mid = (lo + hi) / 2;
        let ord = compare(text, sa[mid] as usize, pattern, &mut crate::search::Silent);
        let right = if upper_bound { ord != Ordering::Greater } else { ord == Ordering::Less };
        let shown: String = String::from_utf8_lossy(&text[sa[mid] as usize..]).chars().take(pattern.len() + 3).collect();
        lines.push(format!("lo {lo:>2} hi {hi:>2} mid {mid:>2} SA {:>2} suffix {shown:<8} {:?} -> {}", sa[mid],
            ord, if right { format!("lo = {}", mid + 1) } else { format!("hi = {mid}") }));
        if right { lo = mid + 1 } else { hi = mid }
    }
    lines.push(format!("result {lo}"));
    lines
}
