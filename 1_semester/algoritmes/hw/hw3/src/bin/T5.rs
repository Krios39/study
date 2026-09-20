use hw3::bst::BST;
use rand::seq::SliceRandom;
use rand::SeedableRng;
use rand::rngs::StdRng;

fn main() {
    let seeds: [u64; 5] = [42, 123, 777, 2026, 9999];
    let ns = [1_000, 10_000];
    let ls = [1, 4, 16, 64, 256];

    println!("{:<6} | {:<4} | {:<8} | {:<12} | {:<10} | {:<10} | {}",
             "N", "L", "Avg Ht", "Avg Ins Cmp", "Mean Srch", "95th Srch", "Status");
    println!("{:-<80}", "");

    for &n in &ns {
        let mut baseline_mean = 0.0;

        for &l in &ls {
            let mut sum_height = 0.0;
            let mut sum_ins_cmp = 0.0;
            let mut sum_mean_srch = 0.0;
            let mut sum_95th_srch = 0.0;

            for &seed in &seeds {
                let mut blocks = Vec::new();
                let mut start = 0;
                while start < n {
                    let end = (start + l).min(n);
                    let block: Vec<i32> = (start..end).map(|x| x as i32).collect();
                    blocks.push(block);
                    start = end;
                }

                let mut rng = StdRng::seed_from_u64(seed);
                blocks.shuffle(&mut rng);

                let mut keys = Vec::new();
                for b in blocks { keys.extend(b); }

                let mut tree = BST::new();
                let mut total_ins = 0;
                let mut max_depth = 0;
                for &k in &keys {
                    let depth = tree.insert_iterative(k);
                    total_ins += depth;
                    if depth > max_depth { max_depth = depth; } // Высота дерева без рекурсии!
                }

                // 4. Тестируем поиск
                let mut search_comps = Vec::with_capacity(n as usize);
                let mut total_srch = 0;
                for i in 0..n {
                    let c = tree.search_iterative_comps(&(i as i32));
                    search_comps.push(c);
                    total_srch += c;
                }

                search_comps.sort_unstable();
                let p95_idx = (0.95 * n as f64).ceil() as usize - 1;

                sum_height += max_depth as f64;
                sum_ins_cmp += total_ins as f64;
                sum_mean_srch += total_srch as f64 / n as f64;
                sum_95th_srch += search_comps[p95_idx] as f64;
            }

            let avg_height = sum_height / 5.0;
            let avg_ins_cmp = sum_ins_cmp / 5.0;
            let avg_mean_srch = sum_mean_srch / 5.0;
            let avg_95th = sum_95th_srch / 5.0;

            if l == 1 { baseline_mean = avg_mean_srch; }

            let mut status = "".to_string();
            if avg_mean_srch >= 2.0 * baseline_mean {
                status = ">= 2x BASELINE".to_string();
            }

            println!("{:<6} | {:<4} | {:<8.1} | {:<12.0} | {:<10.2} | {:<10.1} | {}",
                     n, l, avg_height, avg_ins_cmp, avg_mean_srch, avg_95th, status);
        }
        println!("{:-<80}", "");
    }
}