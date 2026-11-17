pub struct Node {
    pub children: Vec<usize>,
    pub depth: usize,
    pub label: Vec<u8>,
    pub interval: Option<(usize, usize)>,
    pub leaf: Option<usize>,
    pub name: Option<String>,
    pub mark: Option<(usize, &'static str, f64)>,
    pub fail: Option<(usize, char, &'static str)>,
    pub locus: Option<(String, &'static str)>,
    pub highlight: Option<&'static str>,
}

const CW: f64 = 36.0;
const ROW: f64 = 44.0;
const LEFT: f64 = 40.0;

pub fn svg(nodes: &[Node], title: &str, notes: &[String], legend: &[(&str, &str)]) -> String {
    let top = 70.0 + 15.0 * notes.len() as f64 + 30.0;
    let mut y = vec![0.0; nodes.len()];
    let mut order = Vec::new();
    let mut stack = vec![0usize];
    let mut row = 0.0;
    while let Some(u) = stack.pop() {
        order.push(u);
        if nodes[u].children.is_empty() {
            y[u] = top + row * ROW;
            row += 1.0;
        }
        stack.extend(nodes[u].children.iter().rev());
    }
    for &u in order.iter().rev() {
        if let Some(&c) = nodes[u].children.first() {
            y[u] = y[c];
        }
    }
    let maxd = nodes.iter().map(|n| n.depth).max().unwrap() as f64;
    let width = LEFT + maxd * CW + 60.0;
    let height = top + (row - 1.0) * ROW + 30.0;
    let x = |u: usize| LEFT + nodes[u].depth as f64 * CW;
    let mut out = format!(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" font-family="Consolas, 'DejaVu Sans Mono', monospace">"#);
    out += &format!(r#"<rect width="100%" height="100%" fill="white"/><text x="{LEFT}" y="34" font-size="20" font-weight="bold">{title}</text>"#);
    for (k, line) in notes.iter().enumerate() {
        out += &format!(r##"<text x="{LEFT}" y="{}" font-size="12" fill="#334155">{line}</text>"##, 60.0 + 15.0 * k as f64);
    }
    let ly = 60.0 + 15.0 * notes.len() as f64 + 8.0;
    let mut lx = LEFT;
    for (name, color) in legend {
        out += &format!(r#"<rect x="{lx}" y="{}" width="18" height="4" fill="{color}"/><text x="{}" y="{}" font-size="12" fill="{color}" font-weight="bold">{name}</text>"#, ly - 4.0, lx + 22.0, ly);
        lx += 22.0 + 7.5 * name.chars().count() as f64 + 24.0;
    }
    for u in 0..nodes.len() {
        for &c in &nodes[u].children {
            let (px, py, cx, cy) = (x(u), y[u], x(c), y[c]);
            out += &format!(r##"<path d="M{px} {py} V{cy} H{cx}" fill="none" stroke="#94a3b8" stroke-width="1.3"/>"##);
            let (reach, color, off) = nodes[c].mark.unwrap_or((0, "#0f172a", 0.0));
            if reach > 0 {
                out += &format!(r#"<path d="M{} {py} V{} H{}" fill="none" stroke="{color}" stroke-width="3" opacity="0.8"/>"#, px + off, cy + off, px + reach as f64 * CW);
            }
            for (k, &ch) in nodes[c].label.iter().enumerate() {
                let (fill, weight) = if k < reach { (color, "bold") } else { ("#0f172a", "normal") };
                out += &format!(r#"<text x="{}" y="{}" font-size="15" text-anchor="middle" fill="{fill}" font-weight="{weight}">{}</text>"#, px + (k as f64 + 0.5) * CW, cy - 6.0, ch as char);
            }
            if let Some((text, color)) = &nodes[c].locus {
                let lx = px + reach as f64 * CW;
                out += &format!(r#"<path d="M{lx} {} l7 9 l-7 9 l-7 -9 z" fill="{color}" stroke="white" stroke-width="1"/>"#, cy - 9.0);
                out += &format!(r#"<text x="{}" y="{}" font-size="12" fill="{color}" font-weight="bold">{text}</text>"#, lx + 6.0, cy + 24.0);
            }
            if let Some((a, b)) = nodes[c].interval {
                out += &format!(r##"<text x="{}" y="{}" font-size="9" text-anchor="middle" fill="#64748b">[{a},{b})</text>"##, (px + cx) / 2.0, cy + 13.0);
            }
        }
        if let Some((k, ch, color)) = nodes[u].fail {
            let (fx, fy) = match nodes[u].children.first() {
                _ if k > 0 => {
                    let parent = (0..nodes.len()).find(|&p| nodes[p].children.contains(&u)).unwrap();
                    (x(parent) + k as f64 * CW, y[u])
                }
                _ => (x(u), y[u]),
            };
            out += &format!(r#"<text x="{}" y="{}" font-size="14" fill="{color}" font-weight="bold">✗{ch}</text>"#, fx + 3.0, fy - 18.0);
            out += &format!(r#"<line x1="{}" y1="{}" x2="{}" y2="{}" stroke="{color}" stroke-width="2.5"/>"#, fx, fy - 9.0, fx, fy + 9.0);
        }
        if let (Some(p), Some(color)) = (nodes[u].leaf, nodes[u].highlight) {
            out += &format!(r##"<rect x="{}" y="{}" width="10" height="10" fill="{color}"/><rect x="{}" y="{}" width="{}" height="17" rx="3" fill="none" stroke="{color}" stroke-width="2"/><text x="{}" y="{}" font-size="13" font-weight="bold" fill="{color}">{p}</text>"##, x(u) - 5.0, y[u] - 5.0, x(u) + 4.0, y[u] - 9.0, 12.0 + 8.0 * p.to_string().len() as f64, x(u) + 8.0, y[u] + 5.0);
        } else if let Some(p) = nodes[u].leaf {
            out += &format!(r##"<rect x="{}" y="{}" width="8" height="8" fill="#0f172a"/><text x="{}" y="{}" font-size="13" font-weight="bold" fill="#0f172a">{p}</text>"##, x(u) - 4.0, y[u] - 4.0, x(u) + 8.0, y[u] + 5.0);
        } else if let Some(name) = &nodes[u].name {
            out += &format!(r##"<circle cx="{}" cy="{}" r="8" fill="white" stroke="#0f172a" stroke-width="1.3"/><text x="{}" y="{}" font-size="7.5" text-anchor="middle">{name}</text>"##, x(u), y[u], x(u), y[u] + 3.0);
        } else {
            out += &format!(r##"<circle cx="{}" cy="{}" r="3" fill="#334155"/>"##, x(u), y[u]);
        }
    }
    out + "</svg>"
}
