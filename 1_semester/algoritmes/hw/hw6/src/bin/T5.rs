use std::fs;

use hw6::{astar, cells_json, load_terrain, manhattan, path_cost};
use serde_json::json;

fn main() {
    let terrain = load_terrain("HW6_terrain.json");

    let t = terrain.queries[0].1;
    let v = (t.0, t.1 - 1);
    let one = astar(&terrain.a, v, t, |_| 0).cost;
    println!("2h check on map A: vertex {v:?}, target {t:?}: h = {}, 2h = {}, true remaining cost = {one}",
             manhattan(t)(v), 2 * manhattan(t)(v));

    println!("\n{:<4} {:<4} {:>8} {:>16} {:>11} {:>8} {:>11}",
             "map", "q", "cost", "Dijkstra settled", "A* settled", "ratio", "2h-A* cost");
    let mut cases = Vec::new();
    for (case, grid) in [("A", &terrain.a), ("B", &terrain.b)] {
        for (qi, &(s, t)) in terrain.queries.iter().enumerate() {
            let dij = astar(grid, s, t, |_| 0);
            let ast = astar(grid, s, t, manhattan(t));
            let h = manhattan(t);
            let ast2 = astar(grid, s, t, |c| 2 * h(c));
            assert_eq!(dij.cost, ast.cost, "A* and Dijkstra disagree");
            assert_eq!(path_cost(grid, &dij.path), dij.cost);
            assert_eq!(path_cost(grid, &ast.path), ast.cost);
            let ratio = ast.settled.len() as f64 / dij.settled.len() as f64;
            println!("{case:<4} Q{:<3} {:>8} {:>16} {:>11} {:>8.3} {:>11}",
                     qi + 1, dij.cost, dij.settled.len(), ast.settled.len(), ratio, ast2.cost);
            cases.push(json!({
                "map": case, "query": qi + 1, "cost": dij.cost,
                "dijkstra_settled_count": dij.settled.len(), "astar_settled_count": ast.settled.len(),
                "ratio": ratio, "same_path": dij.path == ast.path,
                "dijkstra_path": cells_json(&dij.path), "astar_path": cells_json(&ast.path),
                "dijkstra_settled": cells_json(&dij.settled), "astar_settled": cells_json(&ast.settled),
                "double_h_cost": ast2.cost, "double_h_settled_count": ast2.settled.len(),
            }));
        }
    }
    let worst = cases.iter().max_by(|a, b| a["ratio"].as_f64().partial_cmp(&b["ratio"].as_f64()).unwrap()).unwrap();
    println!("\nLargest ratio (least saving): map {} Q{}", worst["map"], worst["query"]);
    fs::write("HW6_T5_results.json", serde_json::to_string(&cases).unwrap()).unwrap();
    println!("Wrote HW6_T5_results.json");
}
