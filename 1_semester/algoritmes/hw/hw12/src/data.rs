pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Rng(seed)
    }

    pub fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    pub fn below(&mut self, n: u64) -> u64 {
        ((self.next() >> 32) * n) >> 32
    }
}

pub fn uniform(n: usize, alphabet: &[u8], seed: u64) -> Vec<u8> {
    let mut rng = Rng::new(seed);
    (0..n).map(|_| alphabet[rng.below(alphabet.len() as u64) as usize]).collect()
}

pub const LOWER: &[u8] = b"abcdefghijklmnopqrstuvwxyz";

pub fn skewed(n: usize, alphabet: &[u8], heavy: u8, per_mille: u64, seed: u64) -> Vec<u8> {
    let rest: Vec<u8> = alphabet.iter().copied().filter(|&c| c != heavy).collect();
    let mut rng = Rng::new(seed);
    (0..n)
        .map(|_| if rng.below(1000) < per_mille { heavy } else { rest[rng.below(rest.len() as u64) as usize] })
        .collect()
}

pub fn periodic(n: usize, unit: &[u8]) -> Vec<u8> {
    unit.iter().copied().cycle().take(n).collect()
}

pub fn mutated(n: usize, base: u8, other: u8, per_mille: u64, seed: u64) -> Vec<u8> {
    let mut rng = Rng::new(seed);
    (0..n).map(|_| if rng.below(1000) < per_mille { other } else { base }).collect()
}
