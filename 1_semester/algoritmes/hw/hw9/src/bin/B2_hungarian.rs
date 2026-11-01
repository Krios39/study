use std::time::Instant;

use serde_json::json;

use hw9::*;

fn hungarian(d: &[Vec<f64>]) -> Vec<usize> {
    let n = d.len();
    let big = 1e9;
    let cost = |i: usize, j: usize| if i == j { big } else { d[i][j] };
    let mut u = vec![0.0; n + 1];
    let mut v = vec![0.0; n + 1];
    let mut owner = vec![0usize; n + 1];
    let mut way = vec![0usize; n + 1];
    for i in 1..=n {
        owner[0] = i;
        let mut j0 = 0;
        let mut minv = vec![f64::INFINITY; n + 1];
        let mut used = vec![false; n + 1];
        loop {
            used[j0] = true;
            let i0 = owner[j0];
            let mut delta = f64::INFINITY;
            let mut j1 = 0;
            for j in 1..=n {
                if !used[j] {
                    let cur = cost(i0 - 1, j - 1) - u[i0] - v[j];
                    if cur < minv[j] {
                        minv[j] = cur;
                        way[j] = j0;
                    }
                    if minv[j] < delta {
                        delta = minv[j];
                        j1 = j;
                    }
                }
            }
            for j in 0..=n {
                if used[j] {
                    u[owner[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }
            j0 = j1;
            if owner[j0] == 0 {
                break;
            }
        }
        while j0 != 0 {
            let j1 = way[j0];
            owner[j0] = owner[j1];
            j0 = j1;
        }
    }
    let mut next = vec![0; n];
    for j in 1..=n {
        next[owner[j] - 1] = j - 1;
    }
    next
}

fn cycles_of(next: &[usize]) -> Vec<Vec<usize>> {
    let mut seen = vec![false; next.len()];
    let mut cycles = Vec::new();
    for s in 0..next.len() {
        if !seen[s] {
            let mut c = Vec::new();
            let mut u = s;
            while !seen[u] {
                seen[u] = true;
                c.push(u);
                u = next[u];
            }
            cycles.push(c);
        }
    }
    cycles
}

fn patch(d: &[Vec<f64>], mut cycles: Vec<Vec<usize>>) -> Vec<usize> {
    while cycles.len() > 1 {
        let mut best = (f64::INFINITY, 0, 0, 0, 0, false);
        for x in 0..cycles.len() {
            for y in x + 1..cycles.len() {
                let (cx, cy) = (&cycles[x], &cycles[y]);
                for i in 0..cx.len() {
                    let (a, b) = (cx[i], cx[(i + 1) % cx.len()]);
                    for j in 0..cy.len() {
                        let (c, e) = (cy[j], cy[(j + 1) % cy.len()]);
                        let base = d[a][b] + d[c][e];
                        let same = d[a][e] + d[c][b] - base;
                        let flip = d[a][c] + d[e][b] - base;
                        if same < best.0 {
                            best = (same, x, y, i, j, false);
                        }
                        if flip < best.0 {
                            best = (flip, x, y, i, j, true);
                        }
                    }
                }
            }
        }
        let (_, x, y, i, j, flip) = best;
        let cy = cycles.remove(y);
        let m = cy.len();
        let mut piece: Vec<usize> = (0..m).map(|k| cy[(j + 1 + k) % m]).collect();
        if flip {
            piece.reverse();
        }
        let cx = &mut cycles[x];
        cx.splice(i + 1..i + 1, piece);
    }
    cycles.pop().unwrap()
}

fn main() {
    let dir = "src/bin/tsp2000";
    let points = load_points("HW9_TSP_2000.txt");
    let d = point_distances(&points);

    let t = Instant::now();
    let next = hungarian(&d);
    let hungarian_time = t.elapsed().as_secs_f64();
    let assignment: f64 = next.iter().enumerate().map(|(i, &j)| d[i][j]).sum();
    let cycles = cycles_of(&next);
    let two_cycles = cycles.iter().filter(|c| c.len() == 2).count();
    println!("assignment {assignment:.3}, {} cycles ({two_cycles} of length 2), {hungarian_time:.3}s", cycles.len());

    let count = cycles.len();
    let t = Instant::now();
    let tour = patch(&d, cycles);
    let patch_time = t.elapsed().as_secs_f64();
    assert_eq!(tour.len(), points.len());
    let length = tour_length(&d, &tour);
    println!("patched tour {length:.3}, {patch_time:.3}s");

    save_ids(&tour, &format!("{dir}/HW9_B2_hungarian.txt"));
    std::fs::write(format!("{dir}/HW9_B2_hungarian_results.json"), serde_json::to_string_pretty(&json!({
        "method": "assignment problem by the Hungarian method, subtours merged by the cheapest exchange of two edges",
        "assignment_cost": assignment, "cycles": count, "two_cycles": two_cycles,
        "hungarian_seconds": hungarian_time, "patch_seconds": patch_time, "length": length,
    })).unwrap()).unwrap();
}
