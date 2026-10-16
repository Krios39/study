pub mod draw;

use std::fs::{self, File};

use serde_json::Value;

pub struct Image {
    pub width: usize,
    pub height: usize,
    pub rgb: Vec<u8>,
}

impl Image {
    pub fn pixel(&self, x: usize, y: usize) -> [u8; 3] {
        let i = 3 * (y * self.width + x);
        [self.rgb[i], self.rgb[i + 1], self.rgb[i + 2]]
    }

    pub fn len(&self) -> usize {
        self.width * self.height
    }
}

pub fn load_png(path: &str) -> Image {
    let decoder = png::Decoder::new(File::open(path).expect("cannot open PNG"));
    let mut reader = decoder.read_info().expect("bad PNG");
    let mut buf = vec![0; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buf).expect("bad PNG frame");
    assert_eq!(info.color_type, png::ColorType::Rgb, "expected RGB PNG");
    assert_eq!(info.bit_depth, png::BitDepth::Eight, "expected 8-bit PNG");
    buf.truncate(info.buffer_size());
    Image { width: info.width as usize, height: info.height as usize, rgb: buf }
}

pub struct Pca {
    pub mean: [f64; 3],
    pub axes: [[f64; 3]; 3],
    pub variance: [f64; 3],
}

fn jacobi_eigen(mut a: [[f64; 3]; 3]) -> ([f64; 3], [[f64; 3]; 3]) {
    let mut v = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
    for _ in 0..100 {
        let off = a[0][1].powi(2) + a[0][2].powi(2) + a[1][2].powi(2);
        if off < 1e-30 {
            break;
        }
        for (p, q) in [(0, 1), (0, 2), (1, 2)] {
            if a[p][q].abs() < 1e-300 {
                continue;
            }
            let theta = (a[q][q] - a[p][p]) / (2.0 * a[p][q]);
            let t = theta.signum() / (theta.abs() + (theta * theta + 1.0).sqrt());
            let t = if theta == 0.0 { 1.0 } else { t };
            let c = 1.0 / (t * t + 1.0).sqrt();
            let s = t * c;
            for k in 0..3 {
                let (akp, akq) = (a[k][p], a[k][q]);
                a[k][p] = c * akp - s * akq;
                a[k][q] = s * akp + c * akq;
            }
            for k in 0..3 {
                let (apk, aqk) = (a[p][k], a[q][k]);
                a[p][k] = c * apk - s * aqk;
                a[q][k] = s * apk + c * aqk;
            }
            for k in 0..3 {
                let (vkp, vkq) = (v[k][p], v[k][q]);
                v[k][p] = c * vkp - s * vkq;
                v[k][q] = s * vkp + c * vkq;
            }
        }
    }
    ([a[0][0], a[1][1], a[2][2]], v)
}

impl Pca {
    pub fn fit(image: &Image) -> Pca {
        let n = image.len() as f64;
        let mut mean = [0.0; 3];
        for px in image.rgb.chunks_exact(3) {
            for k in 0..3 {
                mean[k] += px[k] as f64 / 255.0;
            }
        }
        mean = mean.map(|m| m / n);
        let mut cov = [[0.0; 3]; 3];
        for px in image.rgb.chunks_exact(3) {
            let d = [0, 1, 2].map(|k| px[k] as f64 / 255.0 - mean[k]);
            for i in 0..3 {
                for j in 0..3 {
                    cov[i][j] += d[i] * d[j];
                }
            }
        }
        let cov = cov.map(|row| row.map(|x| x / n));
        let (values, vectors) = jacobi_eigen(cov);
        let mut order = [0, 1, 2];
        order.sort_by(|&i, &j| values[j].partial_cmp(&values[i]).unwrap());
        let mut axes = [[0.0; 3]; 3];
        let mut variance = [0.0; 3];
        for (col, &src) in order.iter().enumerate() {
            variance[col] = values[src].max(0.0);
            let mut column = [0, 1, 2].map(|r| vectors[r][src]);
            let biggest = (0..3).max_by(|&i, &j| column[i].abs().partial_cmp(&column[j].abs()).unwrap()).unwrap();
            if column[biggest] < 0.0 {
                column = column.map(|x| -x);
            }
            for r in 0..3 {
                axes[r][col] = column[r];
            }
        }
        Pca { mean, axes, variance }
    }

    pub fn explained(&self) -> [f64; 3] {
        let total: f64 = self.variance.iter().sum();
        self.variance.map(|v| v / total)
    }

    pub fn to_json(&self) -> Value {
        serde_json::json!({
            "mean": self.mean, "axes_columns": self.axes, "variance": self.variance, "explained_fraction": self.explained(),
            "scaling": "RGB/255; centred; no whitening or per-channel standardisation",
        })
    }

    pub fn load(path: &str) -> Pca {
        let data: Value = serde_json::from_str(&fs::read_to_string(path).expect("cannot read PCA model")).unwrap();
        let m = &data["model"];
        let mean = [0, 1, 2].map(|i| m["mean"][i].as_f64().unwrap());
        let axes = [0, 1, 2].map(|r| [0, 1, 2].map(|c| m["axes_columns"][r][c].as_f64().unwrap()));
        let variance = [0, 1, 2].map(|i| m["variance"][i].as_f64().unwrap());
        Pca { mean, axes, variance }
    }

    pub fn project(&self, rgb: [u8; 3]) -> [f64; 3] {
        let v = [0, 1, 2].map(|i| rgb[i] as f64 / 255.0 - self.mean[i]);
        [0, 1, 2].map(|c| v[0] * self.axes[0][c] + v[1] * self.axes[1][c] + v[2] * self.axes[2][c])
    }
}

const CELLS: [(usize, usize); 9] = [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2), (1, 2), (0, 2), (0, 1), (1, 1)];

fn digit_of(col: usize, row: usize) -> char {
    let d = CELLS.iter().position(|&c| c == (col, row)).unwrap() + 1;
    char::from_digit(d as u32, 10).unwrap()
}

#[derive(Clone, Copy, Debug)]
pub struct Rect {
    pub xmin: f64,
    pub ymin: f64,
    pub xmax: f64,
    pub ymax: f64,
}

impl Rect {
    pub fn centre(&self) -> (f64, f64) {
        ((self.xmin + self.xmax) / 2.0, (self.ymin + self.ymax) / 2.0)
    }

    pub fn contains_rect(&self, o: &Rect) -> bool {
        self.xmin <= o.xmin && o.xmax <= self.xmax && self.ymin <= o.ymin && o.ymax <= self.ymax
    }

    pub fn contains(&self, (x, y): (f64, f64)) -> bool {
        self.xmin <= x && x <= self.xmax && self.ymin <= y && y <= self.ymax
    }
}

pub struct NineTree {
    pub root: Rect,
    pub top_is_min_y: bool,
}

impl NineTree {
    pub fn image(width: usize, height: usize) -> NineTree {
        NineTree { root: Rect { xmin: 0.0, ymin: 0.0, xmax: width as f64, ymax: height as f64 }, top_is_min_y: true }
    }

    pub fn plot(root: Rect) -> NineTree {
        NineTree { root, top_is_min_y: false }
    }

    pub fn decode(&self, code: &str) -> Rect {
        let (mut cx, mut ry) = (0usize, 0usize);
        for ch in code.chars() {
            let (col, row) = CELLS[ch.to_digit(10).expect("bad digit") as usize - 1];
            cx = 3 * cx + col;
            ry = 3 * ry + row;
        }
        let n = 3usize.pow(code.len() as u32);
        let ybin = if self.top_is_min_y { ry } else { n - 1 - ry };
        let at = |lo: f64, hi: f64, k: usize| if k == n { hi } else { lo + ((hi - lo) * k as f64) / n as f64 };
        let r = self.root;
        Rect {
            xmin: at(r.xmin, r.xmax, cx),
            xmax: at(r.xmin, r.xmax, cx + 1),
            ymin: at(r.ymin, r.ymax, ybin),
            ymax: at(r.ymin, r.ymax, ybin + 1),
        }
    }

    pub fn bins(&self, (x, y): (f64, f64), depth: u32) -> (usize, usize) {
        let n = 3usize.pow(depth);
        let bin = |v: f64, lo: f64, hi: f64| (((v - lo) / (hi - lo) * n as f64).floor() as isize).clamp(0, n as isize - 1) as usize;
        let col = bin(x, self.root.xmin, self.root.xmax);
        let ybin = bin(y, self.root.ymin, self.root.ymax);
        let row = if self.top_is_min_y { ybin } else { n - 1 - ybin };
        (col, row)
    }

    pub fn code_of_bins(col: usize, row: usize, depth: u32) -> String {
        (0..depth).map(|i| {
            let p = 3usize.pow(depth - 1 - i);
            digit_of(col / p % 3, row / p % 3)
        }).collect()
    }

    pub fn encode(&self, point: (f64, f64), depth: u32) -> String {
        let (col, row) = self.bins(point, depth);
        Self::code_of_bins(col, row, depth)
    }
}

pub struct SplitMix64(pub u64);

impl SplitMix64 {
    pub fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }

    pub fn below(&mut self, n: u64) -> u64 {
        let zone = u64::MAX - u64::MAX % n;
        loop {
            let v = self.next();
            if v < zone {
                return v % n;
            }
        }
    }
}
