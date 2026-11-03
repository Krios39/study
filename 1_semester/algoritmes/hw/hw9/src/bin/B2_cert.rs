use hw9::*;
use std::io::Write;

fn isqrt(n: u128) -> u128 {
    let mut r = (n as f64).sqrt() as u128;
    while r * r > n {
        r -= 1;
    }
    while (r + 1) * (r + 1) <= n {
        r += 1;
    }
    r
}

fn ids(file: &str) -> Vec<usize> {
    std::fs::read_to_string(file).unwrap().split_whitespace().map(|x| x.parse::<usize>().unwrap() - 1).collect()
}

fn edges(t: &[usize]) -> Vec<(usize, usize)> {
    t.iter().zip(t.iter().cycle().skip(1)).map(|(&a, &b)| (a.min(b), a.max(b))).collect()
}

fn neumaier(xs: impl Iterator<Item = f64>) -> f64 {
    let (mut s, mut c) = (0.0f64, 0.0f64);
    for x in xs {
        let t = s + x;
        c += if s.abs() >= x.abs() { (s - t) + x } else { (x - t) + s };
        s = t;
    }
    s + c
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let pts: Vec<(i64, i64)> = load_points("HW9_TSP_2000.txt").iter().map(|&(x, y)| (x as i64, y as i64)).collect();
    let n = pts.len();
    let sq = |a: usize, b: usize| ((pts[a].0 - pts[b].0).pow(2) + (pts[a].1 - pts[b].1).pow(2)) as u128;
    let dist = |a: usize, b: usize| (sq(a, b) as f64).sqrt();
    let s: u128 = args[2].parse().unwrap();
    let floor_w = |q: u128| isqrt(s * s * q);
    let ceil_w = |q: u128| {
        let r = isqrt(s * s * q);
        r + (r * r != s * s * q) as u128
    };
    let record = ids(&args[3]);
    assert_eq!(record.len(), n);
    let mut in_record = vec![vec![false; n]; n];
    for (a, b) in edges(&record) {
        in_record[a][b] = true;
        in_record[b][a] = true;
    }
    let weight = |a: usize, b: usize| if a == b { 0 } else if in_record[a][b] { ceil_w(sq(a, b)) } else { floor_w(sq(a, b)) };
    let biased = |t: &[usize]| edges(t).iter().map(|&(a, b)| weight(a, b)).sum::<u128>();
    let exact = |t: &[usize]| neumaier(edges(t).iter().map(|&(a, b)| dist(a, b)));
    match args[1].as_str() {
        "gen" => {
            let mut f = std::io::BufWriter::new(std::fs::File::create(&args[4]).unwrap());
            writeln!(f, "NAME: hw9_cert_S{s}\nTYPE: TSP\nDIMENSION: {n}\nEDGE_WEIGHT_TYPE: EXPLICIT\nEDGE_WEIGHT_FORMAT: FULL_MATRIX\nEDGE_WEIGHT_SECTION").unwrap();
            let mut max_w = 0;
            for a in 0..n {
                let row: Vec<String> = (0..n).map(|b| {
                    let w = weight(a, b);
                    max_w = max_w.max(w);
                    w.to_string()
                }).collect();
                writeln!(f, "{}", row.join(" ")).unwrap();
            }
            writeln!(f, "EOF").unwrap();
            assert!(max_w <= i32::MAX as u128, "edge weight overflows int32");
            let mut t = std::io::BufWriter::new(std::fs::File::create(&args[5]).unwrap());
            writeln!(t, "{n}").unwrap();
            for chunk in record.chunks(10) {
                writeln!(t, "{}", chunk.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(" ")).unwrap();
            }
            println!("S = {s}, max edge weight {max_w}");
            println!("exact record length {:.12}, scaled {:.4}", exact(&record), exact(&record) * s as f64);
            println!("biased weight of record W(R) = {}  <- Concorde must report exactly this value for the certificate", biased(&record));
        }
        "check" => {
            let text = std::fs::read_to_string(&args[4]).unwrap();
            let sol: Vec<usize> = text.split_whitespace().skip(1).map(|x| x.parse().unwrap()).collect();
            assert_eq!(sol.len(), n);
            let mut seen = vec![false; n];
            for &v in &sol {
                assert!(!seen[v], "node {} repeated", v + 1);
                seen[v] = true;
            }
            let (er, et) = (edges(&record), edges(&sol));
            let mut in_sol = vec![vec![false; n]; n];
            for &(a, b) in &et {
                in_sol[a][b] = true;
                in_sol[b][a] = true;
            }
            let only_t: Vec<_> = et.iter().filter(|&&(a, b)| !in_record[a][b]).collect();
            let only_r: Vec<_> = er.iter().filter(|&&(a, b)| !in_sol[a][b]).collect();
            let delta = neumaier(only_t.iter().map(|&&(a, b)| dist(a, b))) - neumaier(only_r.iter().map(|&&(a, b)| dist(a, b)));
            println!("record: exact {:.12}, biased W(R) = {}", exact(&record), biased(&record));
            println!("concorde tour: exact {:.12}, biased W(T) = {}", exact(&sol), biased(&sol));
            println!("edges only in T: {}, only in R: {}", only_t.len(), only_r.len());
            println!("d(T) - d(R) = {delta:.12}");
            if only_t.is_empty() {
                println!("same cycle as the record");
            } else if delta < 0.0 {
                println!("T is strictly shorter than the record");
                if args.len() > 5 {
                    save_ids(&sol, &args[5]);
                    println!("saved {}", args[5]);
                }
            } else {
                println!("T is not shorter (inconclusive at S = {s}; increase S)");
            }
        }
        _ => panic!("usage: B2_cert gen S record.txt out.tsp out.tour | B2_cert check S record.txt concorde.sol [better.txt]"),
    }
}
