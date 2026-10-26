use std::fs::File;
use std::io::BufWriter;

pub struct Image {
    pub width: usize,
    pub height: usize,
    pub rgb: Vec<u8>,
}

impl Image {
    pub fn row(&self, y: usize) -> &[u8] {
        &self.rgb[3 * self.width * y..3 * self.width * (y + 1)]
    }

    pub fn reorder(&self, order: &[usize]) -> Image {
        let rgb = order.iter().flat_map(|&y| self.row(y).iter().copied()).collect();
        Image { width: self.width, height: order.len(), rgb }
    }

    pub fn save(&self, path: &str) {
        let mut encoder = png::Encoder::new(BufWriter::new(File::create(path).unwrap()), self.width as u32, self.height as u32);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);
        encoder.write_header().unwrap().write_image_data(&self.rgb).unwrap();
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

pub fn row_distance(a: &[u8], b: &[u8]) -> u64 {
    a.iter().zip(b).map(|(&x, &y)| (x as i32 - y as i32).unsigned_abs() as u64).sum()
}

pub fn distance_matrix(img: &Image) -> Vec<Vec<u64>> {
    let n = img.height;
    let mut d = vec![vec![0u64; n]; n];
    for i in 0..n {
        for j in i + 1..n {
            let v = row_distance(img.row(i), img.row(j));
            d[i][j] = v;
            d[j][i] = v;
        }
    }
    d
}

pub fn path_cost(d: &[Vec<u64>], order: &[usize]) -> u64 {
    order.windows(2).map(|w| d[w[0]][w[1]]).sum()
}

pub fn recovered_pairs(order: &[usize], truth: &[usize]) -> (usize, usize) {
    let n = truth.len();
    let mut pos = vec![0; n];
    for (p, &r) in order.iter().enumerate() {
        pos[r] = p;
    }
    let hits = truth.windows(2).filter(|w| pos[w[0]].abs_diff(pos[w[1]]) == 1).count();
    (hits, n - 1)
}

pub fn load_points(path: &str) -> Vec<(f64, f64)> {
    let text = std::fs::read_to_string(path).expect("cannot read points");
    let mut points = Vec::new();
    for line in text.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with('#')) {
        let v: Vec<f64> = line.split_whitespace().map(|x| x.parse().unwrap()).collect();
        assert_eq!(v[0] as usize, points.len() + 1, "IDs must be 1..N in order");
        points.push((v[1], v[2]));
    }
    points
}

pub fn euclid(a: (f64, f64), b: (f64, f64)) -> f64 {
    ((a.0 - b.0).powi(2) + (a.1 - b.1).powi(2)).sqrt()
}

pub fn point_distances(points: &[(f64, f64)]) -> Vec<Vec<f64>> {
    points.iter().map(|&a| points.iter().map(|&b| euclid(a, b)).collect()).collect()
}

pub fn tour_length(d: &[Vec<f64>], tour: &[usize]) -> f64 {
    tour.iter().zip(tour.iter().cycle().skip(1)).map(|(&a, &b)| d[a][b]).sum()
}

pub fn save_ids(ids: &[usize], file: &str) {
    std::fs::write(file, ids.iter().map(|x| (x + 1).to_string()).collect::<Vec<_>>().join("\n") + "\n").unwrap();
}
