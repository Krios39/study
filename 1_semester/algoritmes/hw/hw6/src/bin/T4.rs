use std::fs;

use hw6::{astar, bfs, cells_json, load_terrain, path_cost};
use serde_json::json;

fn main() {
    let terrain = load_terrain("HW6_terrain.json");
    let (source, target) = terrain.queries[0];
    println!("Q1: {source:?} -> {target:?}");
    println!("{:<5} {:<9} {:>10} {:>12}", "map", "search", "path edges", "terrain cost");

    let mut out = serde_json::Map::new();
    for (case, grid) in [("A", &terrain.a), ("B", &terrain.b)] {
        let (bfs_path, _) = bfs(grid, source, target);
        let dij = astar(grid, source, target, |_| 0);
        println!("{case:<5} {:<9} {:>10} {:>12}", "BFS", bfs_path.len() - 1, path_cost(grid, &bfs_path));
        println!("{case:<5} {:<9} {:>10} {:>12}", "Dijkstra", dij.path.len() - 1, dij.cost);
        out.insert(case.into(), json!({
            "bfs_path": cells_json(&bfs_path),
            "dijkstra_path": cells_json(&dij.path),
            "dijkstra_cost": dij.cost,
        }));
    }
    fs::write("HW6_T4_results.json", serde_json::to_string(&out).unwrap()).unwrap();
    println!("Wrote HW6_T4_results.json");
}
