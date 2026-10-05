use rand::{RngExt, SeedableRng};
use rand::rngs::StdRng;

#[derive(Copy, Clone, PartialEq)]
enum Player { X, O }

impl Player {
    fn index(self) -> usize {
        match self { Player::X => 0, Player::O => 1 }
    }
}

fn main() {
    let mut rng = StdRng::seed_from_u64(42);
    let mut zobrist_keys = [[0u64; 9]; 2];
    for p in 0..2 {
        for sq in 0..9 {
            zobrist_keys[p][sq] = rng.random();
        }
    }

    let mut board: [Option<Player>; 9] = [None; 9];
    let mut current_hash: u64 = 0;
    let mut history: Vec<(Player, usize)> = Vec::new();

    let mut total_inc_xors = 0;
    let mut total_full_xors = 0;

    let moves = [
        ("place X at 0", Some((Player::X, 0))),
        ("place O at 4", Some((Player::O, 4))),
        ("place X at 8", Some((Player::X, 8))),
        ("place O at 1", Some((Player::O, 1))),
        ("undo", None),
        ("place O at 2", Some((Player::O, 2))),
        ("place X at 6", Some((Player::X, 6))),
        ("undo", None),
        ("undo", None),
        ("undo", None),
        ("undo", None),
        ("undo", None),
    ];

    println!("| Action               | Incremental Hash | Full Recompute Hash | Inc XORs | Full XORs |");
    println!("|----------------------|------------------|---------------------|----------|-----------|");

    for (action, m) in moves {
        if let Some((p, sq)) = m {
            board[sq] = Some(p);
            current_hash ^= zobrist_keys[p.index()][sq];
            history.push((p, sq));
        } else {
            if let Some((p, sq)) = history.pop() {
                board[sq] = None;
                current_hash ^= zobrist_keys[p.index()][sq];
            }
        }

        let inc_xors = 1;

        let mut full_hash = 0;
        let mut full_xors = 0;
        for sq in 0..9 {
            if let Some(p) = board[sq] {
                full_hash ^= zobrist_keys[p.index()][sq];
                full_xors += 1;
            }
        }

        assert_eq!(current_hash, full_hash, "Хэши не совпадают!");

        println!("| {:20} | {:016x} | {:016x}  | {:8} | {:9} |",
                 action, current_hash, full_hash, inc_xors, full_xors);

        total_inc_xors += inc_xors;
        total_full_xors += full_xors;
    }

    println!("|----------------------|------------------|---------------------|----------|-----------|");
    println!("Total Operations: Incremental = {} XORs, Full Recompute = {} XORs", total_inc_xors, total_full_xors);
    println!("Final Fingerprint: {:016x}", current_hash);
}