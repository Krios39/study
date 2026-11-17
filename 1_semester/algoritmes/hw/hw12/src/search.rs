pub trait Counter {
    fn tick(&mut self);
}

pub struct Count(pub u64);

impl Counter for Count {
    #[inline(always)]
    fn tick(&mut self) {
        self.0 += 1;
    }
}

pub struct Silent;

impl Counter for Silent {
    #[inline(always)]
    fn tick(&mut self) {}
}

pub trait Sink {
    fn hit(&mut self, pos: usize) -> bool;
}

impl Sink for Vec<usize> {
    fn hit(&mut self, pos: usize) -> bool {
        self.push(pos);
        true
    }
}

pub struct Tally(pub usize);

impl Sink for Tally {
    #[inline(always)]
    fn hit(&mut self, _: usize) -> bool {
        self.0 += 1;
        true
    }
}

pub struct First(pub Option<usize>);

impl Sink for First {
    #[inline(always)]
    fn hit(&mut self, pos: usize) -> bool {
        self.0 = Some(pos);
        false
    }
}

#[inline(always)]
fn same<C: Counter>(c: &mut C, a: u8, b: u8) -> bool {
    c.tick();
    a == b
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Method {
    Naive,
    Kmp,
    Horspool,
}

pub const METHODS: [Method; 3] = [Method::Naive, Method::Kmp, Method::Horspool];

impl Method {
    pub fn name(self) -> &'static str {
        match self {
            Method::Naive => "naive",
            Method::Kmp => "KMP",
            Method::Horspool => "Horspool",
        }
    }
}

pub struct Prepared {
    pub method: Method,
    pub pattern: Vec<u8>,
    pub fail: Vec<usize>,
    pub shift: [usize; 256],
}

pub fn prepare<C: Counter>(method: Method, pattern: &[u8], c: &mut C) -> Result<Prepared, &'static str> {
    if pattern.is_empty() {
        return Err("empty pattern");
    }
    let m = pattern.len();
    let mut fail = Vec::new();
    let mut shift = [0usize; 256];
    match method {
        Method::Naive => {}
        Method::Kmp => {
            fail = vec![0; m];
            let mut k = 0;
            for i in 1..m {
                loop {
                    if same(c, pattern[i], pattern[k]) {
                        k += 1;
                        break;
                    }
                    if k == 0 {
                        break;
                    }
                    k = fail[k - 1];
                }
                fail[i] = k;
            }
        }
        Method::Horspool => {
            shift = [m; 256];
            for i in 0..m - 1 {
                shift[pattern[i] as usize] = m - 1 - i;
            }
        }
    }
    Ok(Prepared { method, pattern: pattern.to_vec(), fail, shift })
}

pub fn search<C: Counter, S: Sink>(p: &Prepared, text: &[u8], c: &mut C, sink: &mut S) {
    let pat = &p.pattern[..];
    let (n, m) = (text.len(), pat.len());
    if m > n {
        return;
    }
    match p.method {
        Method::Naive => {
            for pos in 0..=n - m {
                let mut j = 0;
                while j < m && same(c, text[pos + j], pat[j]) {
                    j += 1;
                }
                if j == m && !sink.hit(pos) {
                    return;
                }
            }
        }
        Method::Kmp => {
            let mut k = 0;
            for i in 0..n {
                loop {
                    if same(c, text[i], pat[k]) {
                        k += 1;
                        break;
                    }
                    if k == 0 {
                        break;
                    }
                    k = p.fail[k - 1];
                }
                if k == m {
                    if !sink.hit(i + 1 - m) {
                        return;
                    }
                    k = p.fail[m - 1];
                }
            }
        }
        Method::Horspool => {
            let mut pos = 0;
            while pos + m <= n {
                let mut j = m;
                while j > 0 && same(c, text[pos + j - 1], pat[j - 1]) {
                    j -= 1;
                }
                if j == 0 && !sink.hit(pos) {
                    return;
                }
                pos += p.shift[text[pos + m - 1] as usize];
            }
        }
    }
}

pub fn positions(method: Method, pattern: &[u8], text: &[u8]) -> Result<Vec<usize>, &'static str> {
    let p = prepare(method, pattern, &mut Silent)?;
    let mut out = Vec::new();
    search(&p, text, &mut Silent, &mut out);
    Ok(out)
}

pub fn reference(pattern: &[u8], text: &[u8]) -> Vec<usize> {
    if pattern.len() > text.len() {
        return Vec::new();
    }
    text.windows(pattern.len()).enumerate().filter(|(_, w)| *w == pattern).map(|(i, _)| i).collect()
}

pub fn horspool_trace(pattern: &[u8], text: &[u8]) -> Vec<String> {
    let p = prepare(Method::Horspool, pattern, &mut Silent).unwrap();
    let m = pattern.len();
    let mut lines = vec![format!("text    {}", String::from_utf8_lossy(text))];
    let mut pos = 0;
    while pos + m <= text.len() {
        let mut j = m;
        let mut checked = Vec::new();
        while j > 0 {
            let (a, b) = (text[pos + j - 1], pattern[j - 1]);
            checked.push(format!("{}{}{}", a as char, if a == b { "=" } else { "≠" }, b as char));
            if a != b {
                break;
            }
            j -= 1;
        }
        let last = text[pos + m - 1];
        lines.push(format!(
            "pos {:>2}  {}{}   compared right to left: {}   {}; window ends with '{}', shift {}",
            pos,
            " ".repeat(pos),
            String::from_utf8_lossy(pattern),
            checked.join(" "),
            if j == 0 { "MATCH" } else { "mismatch" },
            last as char,
            p.shift[last as usize]
        ));
        pos += p.shift[last as usize];
    }
    lines
}
