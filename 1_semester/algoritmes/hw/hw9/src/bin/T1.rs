use std::time::Instant;

use serde_json::{Value, json};

use hw9::*;

fn greedy_both_ends(d: &[Vec<u64>], start: usize) -> (Vec<usize>, Vec<usize>) {
    let n = d.len();
    let mut used = vec![false; n];
    let mut chain = std::collections::VecDeque::from([start]);
    let mut added = vec![start];
    used[start] = true;
    while chain.len() < n {
        let best = |end: usize| (0..n).filter(|&j| !used[j]).min_by_key(|&j| (d[end][j], j)).unwrap();
        let (top, bottom) = (*chain.front().unwrap(), *chain.back().unwrap());
        let (up, down) = (best(top), best(bottom));
        if d[top][up] <= d[bottom][down] {
            used[up] = true;
            chain.push_front(up);
            added.push(up);
        } else {
            used[down] = true;
            chain.push_back(down);
            added.push(down);
        }
    }
    (chain.into_iter().collect(), added)
}

fn save_order(order: &[usize], file: &str) {
    std::fs::write(file, order.iter().map(|x| x.to_string()).collect::<Vec<_>>().join("\n") + "\n").unwrap();
}

fn recovered_json(rec: Option<(usize, usize)>) -> Value {
    json!(rec.map(|(h, m)| json!({"pairs": h, "of": m, "fraction": h as f64 / m as f64})))
}

fn recovered_text(rec: Option<(usize, usize)>) -> String {
    rec.map(|(h, m)| format!(" recovered {h}/{m} = {:.4}", h as f64 / m as f64)).unwrap_or_default()
}

fn run(name: &str, path: &str, truth: Option<Vec<usize>>) -> Value {
    let img = load_png(path);
    let t = Instant::now();
    let d = distance_matrix(&img);
    let prep = t.elapsed().as_secs_f64();
    let n = img.height;
    let starts = [0, n / 2, n - 1];
    let mut trials = Vec::new();
    let mut best: Option<(u64, Vec<usize>, usize)> = None;
    for &s in &starts {
        let t = Instant::now();
        let (order, added) = greedy_both_ends(&d, s);
        save_order(&added, &format!("src/bin/{name}/HW9_T1_{name}_v8_insertion_start{s}.txt"));
        let secs = t.elapsed().as_secs_f64();
        let cost = path_cost(&d, &order);
        let rec = truth.as_ref().map(|tr| recovered_pairs(&order, tr));
        println!("{name}: start {s:4} cost {cost:>12} time {secs:.3}s{}", recovered_text(rec));
        trials.push(json!({"start": s, "cost": cost, "seconds": secs, "recovered": recovered_json(rec)}));
        if best.as_ref().is_none_or(|b| cost < b.0) {
            best = Some((cost, order, s));
        }
    }
    let (cost, order, s) = best.unwrap();
    img.reorder(&order).save(&format!("src/bin/{name}/HW9_T1_{name}_v8.png"));
    save_order(&order, &format!("src/bin/{name}/HW9_T1_{name}_v8_order.txt"));
    if let Some(tr) = &truth {
        println!("{name}: correct order cost {}", path_cost(&d, tr));
    }
    json!({"image": path, "width": img.width, "height": n, "distance": "sum of absolute RGB differences", "matrix_seconds": prep,
           "method": "greedy nearest neighbour growing the chain at both ends (course hint): attach the better of the best top match and the best bottom match; ties by row index, then prepend", "trials": trials, "best_start": s, "best_cost": cost,
           "correct_order_cost": truth.as_ref().map(|tr| path_cost(&d, tr))})
}

fn main() {
    let truth: Vec<usize> = std::fs::read_to_string("HW9_rows_test_order.txt").unwrap().split_whitespace().map(|x| x.parse().unwrap()).collect();
    let test = run("test", "HW9_rows_test_shuffled.png", Some(truth));
    let mystery = run("challenge", "HW9_rows_challenge_shuffled.png", None);
    std::fs::write("src/bin/test/HW9_T1_test_v8_results.json", serde_json::to_string_pretty(&test).unwrap()).unwrap();
    std::fs::write("src/bin/challenge/HW9_T1_challenge_v8_results.json", serde_json::to_string_pretty(&mystery).unwrap()).unwrap();
}
