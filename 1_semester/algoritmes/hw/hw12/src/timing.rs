use std::time::Instant;

pub fn median_seconds<F: FnMut() -> usize>(runs: usize, mut f: F) -> (f64, usize) {
    let mut times = Vec::with_capacity(runs);
    let mut result = 0;
    for _ in 0..runs {
        let start = Instant::now();
        result = std::hint::black_box(f());
        times.push(start.elapsed().as_secs_f64());
    }
    times.sort_by(|a, b| a.partial_cmp(b).unwrap());
    (times[runs / 2], result)
}
