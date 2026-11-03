use hw9::*;

fn main() {
    let d = point_distances(&load_points("HW9_TSP_2000.txt"));
    for file in std::env::args().skip(1) {
        let t: Vec<usize> = std::fs::read_to_string(&file).unwrap().split_whitespace().map(|x| x.parse::<usize>().unwrap() - 1).collect();
        let n = t.len();
        let at = |i: usize| t[i % n];
        let (mut best_two, mut count_two) = (f64::INFINITY, 0);
        for i in 0..n {
            for j in i + 2..n {
                if i == 0 && j == n - 1 {
                    continue;
                }
                let delta = d[at(i)][at(j)] + d[at(i + 1)][at(j + 1)] - d[at(i)][at(i + 1)] - d[at(j)][at(j + 1)];
                best_two = best_two.min(delta);
                count_two += (delta < -1e-9) as usize;
            }
        }
        let (mut best_or, mut count_or) = (f64::INFINITY, 0);
        for len in 1..=3 {
            for i in 0..n {
                let (p, f, l, q) = (at(i), at(i + 1), at(i + len), at(i + len + 1));
                let cut = d[p][q] - d[p][f] - d[l][q];
                for k in len + 1..n - 1 {
                    let (c, e) = (at(i + k), at(i + k + 1));
                    let open = cut - d[c][e];
                    let delta = open + (d[c][f] + d[l][e]).min(d[c][l] + d[f][e]);
                    best_or = best_or.min(delta);
                    count_or += (delta < -1e-9) as usize;
                }
            }
        }
        println!("{file}: length {:.6}; 2-opt improving {count_two}, best change {best_two:.6}; or-opt improving {count_or}, best change {best_or:.6}", tour_length(&d, &t));
    }
}
