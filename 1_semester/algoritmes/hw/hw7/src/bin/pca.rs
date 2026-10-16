use std::fs;

use hw7::{Pca, load_png};
use serde_json::json;
use sha2::{Digest, Sha256};

fn main() {
    let a = load_png("HW7_01.png");
    let pca = Pca::fit(&a);
    for (i, f) in pca.explained().iter().enumerate() {
        println!("PC{}: {:.2}% of A's variance", i + 1, 100.0 * f);
    }
    for r in 0..3 {
        println!("axes row {r}: {:?}", pca.axes[r]);
    }
    let hashes: serde_json::Map<String, serde_json::Value> = ["HW7_01.png", "HW7_02.png"].iter()
        .map(|name| {
            let digest = Sha256::digest(fs::read(name).expect("cannot read image"));
            (name.to_string(), json!(digest.iter().map(|b| format!("{b:02x}")).collect::<String>()))
        }).collect();
    let out = json!({ "width": a.width, "height": a.height, "model": pca.to_json(), "sha256": hashes });
    fs::write("HW7_pca_model.json", serde_json::to_string_pretty(&out).unwrap()).unwrap();
    println!("wrote HW7_pca_model.json");
}
