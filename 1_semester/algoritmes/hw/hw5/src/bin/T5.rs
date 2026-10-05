use pbkdf2::pbkdf2_hmac;
use sha2::{Digest, Sha256};
use std::time::Instant;
use subtle::ConstantTimeEq; // Для безопасного константного сравнения хэшей

// Вспомогательная функция для красивого вывода байтов в HEX
fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn main() {
    let password_a = b"demo-password-00-A!";
    let password_b = b"demo-password-00-B!";

    // 1. Демонстрация: Одинаковый пароль + разные соли = разные ключи
    // Функция rand::random() сама сгенерирует массивы [u8; 16]
    let salt1: [u8; 16] = rand::random();
    let salt2: [u8; 16] = rand::random();

    let mut key1 = [0u8; 32];
    let mut key2 = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password_a, &salt1, 100_000, &mut key1);
    pbkdf2_hmac::<Sha256>(password_a, &salt2, 100_000, &mut key2);

    println!("--- PBKDF2 (100k): Same Password, Different Salts ---");
    println!("Salt 1: {} \n-> Key: {}", to_hex(&salt1), to_hex(&key1));
    println!("Salt 2: {} \n-> Key: {}", to_hex(&salt2), to_hex(&key2));
    println!("Keys differ: {}\n", key1 != key2);

    // 2. Верификация правильного и неправильного пароля (Salt 1)
    println!("--- Verification Results ---");
    let mut verify_a = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password_a, &salt1, 100_000, &mut verify_a);
    let is_a_correct = bool::from(key1.ct_eq(&verify_a)); // Защита от timing-атак
    println!("Verify correct password ('A!'): {}", is_a_correct);

    let mut verify_b = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password_b, &salt1, 100_000, &mut verify_b);
    let is_b_correct = bool::from(key1.ct_eq(&verify_b));
    println!("Verify wrong password   ('B!'): {}\n", is_b_correct);

    // 3. Замеры времени (медианы по 3 прогонам)
    println!("--- Timing (Per Call) ---");

    // Замер базового SHA-256
    let mut med_sha = Vec::new();
    for _ in 0..3 {
        let start = Instant::now();
        let iters = 100_000; // Легкий хэш, можно делать огромный батч
        for _ in 0..iters {
            let mut hasher = Sha256::new();
            hasher.update(&salt1);
            hasher.update(password_a);
            let _ = hasher.finalize();
        }
        med_sha.push(start.elapsed().as_secs_f64() / (iters as f64));
    }
    med_sha.sort_by(|a, b| a.partial_cmp(b).unwrap());

    // Замер PBKDF2 (100,000)
    let mut med_100k = Vec::new();
    for _ in 0..3 {
        let start = Instant::now();
        let iters = 10; // Тяжелый хэш, батч поменьше
        for _ in 0..iters {
            let mut buf = [0u8; 32];
            pbkdf2_hmac::<Sha256>(password_a, &salt1, 100_000, &mut buf);
        }
        med_100k.push(start.elapsed().as_secs_f64() / (iters as f64));
    }
    med_100k.sort_by(|a, b| a.partial_cmp(b).unwrap());

    // Замер PBKDF2 (200,000)
    let mut med_200k = Vec::new();
    for _ in 0..3 {
        let start = Instant::now();
        let iters = 10;
        for _ in 0..iters {
            let mut buf = [0u8; 32];
            pbkdf2_hmac::<Sha256>(password_a, &salt1, 200_000, &mut buf);
        }
        med_200k.push(start.elapsed().as_secs_f64() / (iters as f64));
    }
    med_200k.sort_by(|a, b| a.partial_cmp(b).unwrap());

    println!("SHA-256 (salted):      {:.9} s", med_sha[1]);
    println!("PBKDF2-HMAC (100k):    {:.6} s", med_100k[1]);
    println!("PBKDF2-HMAC (200k):    {:.6} s", med_200k[1]);
}