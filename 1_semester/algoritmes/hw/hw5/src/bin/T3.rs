use std::fs::File;
use std::io::{self, BufRead, Write};
use std::time::Instant;
use rand::{RngExt, SeedableRng};
use rand::rngs::StdRng;

fn main() -> io::Result<()> {
    let file_path = "stream.txt";
    let seeds = [100, 101, 102];
    let q: f64 = 1.1;

    let mut med_gen = Vec::new();
    let mut med_ex = Vec::new();
    let mut med_mo = Vec::new();

    println!("| Morris Seed | Morris MARE | Saturating-byte MARE |");
    println!("|-------------|-------------|----------------------|");

    for &seed in &seeds {
        let mut rng = StdRng::seed_from_u64(seed);
        let mut exact = vec![0u32; 1024];
        let mut morris_c = vec![0u8; 1024];

        let mut time_gen = 0.0;
        let mut time_exact = 0.0;
        let mut time_morris = 0.0;

        let file = File::open(file_path).expect("Файл stream.txt не найден!");
        let mut lines = io::BufReader::new(file).lines().filter_map(|l| l.ok().and_then(|s| s.parse::<usize>().ok()));

        let mut exact_first = true;

        loop {
            let t0 = Instant::now();
            let mut batch = Vec::with_capacity(10000);
            for _ in 0..10000 {
                if let Some(val) = lines.next() {
                    batch.push(val);
                } else {
                    break;
                }
            }
            time_gen += t0.elapsed().as_secs_f64();

            if batch.is_empty() { break; }

            if exact_first {
                let t_ex = Instant::now();
                for &v in &batch { exact[v] += 1; }
                time_exact += t_ex.elapsed().as_secs_f64();

                let t_mo = Instant::now();
                for &v in &batch {
                    if morris_c[v] < 255 {
                        let prob = q.powf(-(morris_c[v] as f64));
                        if rng.random_range(0.0..1.0) < prob {
                            morris_c[v] += 1;
                        }
                    }
                }
                time_morris += t_mo.elapsed().as_secs_f64();
            } else {
                let t_mo = Instant::now();
                for &v in &batch {
                    if morris_c[v] < 255 {
                        let prob = q.powf(-(morris_c[v] as f64));
                        if rng.random::<f64>() < prob {
                            morris_c[v] += 1;
                        }
                    }
                }
                time_morris += t_mo.elapsed().as_secs_f64();

                let t_ex = Instant::now();
                for &v in &batch { exact[v] += 1; }
                time_exact += t_ex.elapsed().as_secs_f64();
            }
            exact_first = !exact_first;
        }

        let total_exact: u32 = exact.iter().sum();
        assert_eq!(total_exact, 10_000_000, "Сумма Exact не равна 10 млн!");
        assert!(*morris_c.iter().max().unwrap() < 255, "Morris достиг 255!");

        let mut morris_mare_sum = 0.0;
        let mut sat_mare_sum = 0.0;

        for v in 0..1024 {
            let ex = exact[v] as f64;
            let est = (q.powi(morris_c[v] as i32) - 1.0) / (q - 1.0);
            let sat = exact[v].min(255) as f64;

            if ex > 0.0 {
                morris_mare_sum += (est - ex).abs() / ex;
                sat_mare_sum += (sat - ex).abs() / ex;
            }
        }

        println!("| {} | {:.4} | {:.4} |", seed, morris_mare_sum / 1024.0, sat_mare_sum / 1024.0);

        med_gen.push(time_gen);
        med_ex.push(time_exact);
        med_mo.push(time_morris);

        // Дамп данных для графика (только для seed 100)
        if seed == 100 {
            let mut file = File::create("plot_data.csv")?;
            writeln!(file, "exact,morris,saturated")?;
            let mut indices: Vec<usize> = (0..1024).collect();
            indices.sort_by_key(|&i| exact[i]); // Сортировка по точной частоте

            for i in indices {
                let ex = exact[i];
                let mo = (q.powi(morris_c[i] as i32) - 1.0) / (q - 1.0);
                let sat = exact[i].min(255);
                writeln!(file, "{},{:.2},{}", ex, mo, sat)?;
            }
        }
    }

    med_gen.sort_by(|a, b| a.partial_cmp(b).unwrap());
    med_ex.sort_by(|a, b| a.partial_cmp(b).unwrap());
    med_mo.sort_by(|a, b| a.partial_cmp(b).unwrap());

    println!("\n| Phase | Median Total Seconds | Throughput (M events/s) |");
    println!("|-------|----------------------|-------------------------|");
    println!("| Generation | {:.4} | {:.2} |", med_gen[1], 10.0 / med_gen[1]);
    println!("| Exact Counting | {:.4} | {:.2} |", med_ex[1], 10.0 / med_ex[1]);
    println!("| Morris Counting | {:.4} | {:.2} |", med_mo[1], 10.0 / med_mo[1]);

    Ok(())
}