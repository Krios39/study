use std::fs;

use hw6::{Grid, astar, bfs_table, cells_json, load_terrain, manhattan, path_cost};
use serde_json::json;

fn relaxed(b: &Grid, keep: usize) -> Grid {
    b.iter().map(|row| row.iter().enumerate().map(|(c, &v)| {
        if v == 0 && c == keep { 0 } else { 1 }
    }).collect()).collect()
}

fn main() {
    let terrain = load_terrain("HW6_terrain.json");
    let b = &terrain.b;
    let cells = b.len() * b[0].len();

    let mut out = serde_json::Map::new();
    for keep in [29usize, 59] {
        let rel = relaxed(b, keep);
        println!("=== Relaxed map keeps the wall at column {keep} ===");
        println!("{:<4} {:>6} {:>16} {:>17} {:>14} {:>16}",
                 "q", "cost", "Manhattan settled", "preprocess visited", "table entries", "relaxed settled");
        let mut rows = Vec::new();
        let (mut total_m, mut total_r) = (0, 0);
        for (qi, &(s, t)) in terrain.queries.iter().enumerate() {
            let (table, visited) = bfs_table(&rel, t);
            let entries = table.iter().flatten().filter(|d| d.is_some()).count();
            let h = |(r, c): (usize, usize)| table[r][c].expect("cell unreachable in relaxed map");

            for r in 0..b.len() {
                for c in 0..b[0].len() {
                    if b[r][c] != 0 {
                        for (v, w) in hw6::neighbours(b, (r, c)) {
                            assert!(h((r, c)) <= w + h(v));
                        }
                    }
                }
            }

            let man = astar(b, s, t, manhattan(t));
            let rlx = astar(b, s, t, h);
            let dij = astar(b, s, t, |_| 0);
            assert_eq!(man.cost, dij.cost);
            assert_eq!(rlx.cost, dij.cost);
            assert_eq!(path_cost(b, &rlx.path), rlx.cost);
            assert!(h(s) <= dij.cost, "heuristic overestimates");
            total_m += man.settled.len();
            total_r += rlx.settled.len();
            println!("Q{:<3} {:>6} {:>16} {:>17} {:>14} {:>16}",
                     qi + 1, dij.cost, man.settled.len(), visited, entries, rlx.settled.len());
            rows.push(json!({
                "query": qi + 1, "cost": dij.cost, "h_source": h(s), "manhattan_h_source": manhattan(t)(s),
                "manhattan_settled_count": man.settled.len(), "relaxed_settled_count": rlx.settled.len(),
                "dijkstra_settled_count": dij.settled.len(),
                "preprocess_visited": visited, "table_entries": entries, "grid_cells": cells,
                "manhattan_path": cells_json(&man.path), "relaxed_path": cells_json(&rlx.path),
                "manhattan_settled": cells_json(&man.settled), "relaxed_settled": cells_json(&rlx.settled),
            }));
        }
        println!("Total online settled: Manhattan {total_m}, relaxed {total_r}\n");
        out.insert(keep.to_string(), json!(rows));
    }
    fs::write("HW6_B2_results.json", serde_json::to_string(&out).unwrap()).unwrap();
    println!("Wrote HW6_B2_results.json");
}
