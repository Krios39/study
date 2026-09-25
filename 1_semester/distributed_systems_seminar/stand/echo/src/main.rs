//! Эхо-сервис для замеров: околонулевое время обработки, размер ответа задаёт клиент.
//!
//!   GET  /echo?size=N[&fill=random][&delay=MS]
//!        -> N байт (по умолчанию 1024, максимум 4 MiB), опц. задержка MS мс
//!        fill=random — несжимаемые псевдослучайные байты (детерминированные), иначе abcdef…
//!   POST /echo[?delay=MS]         -> тело запроса как есть
//!   GET  /health                  -> ok

use axum::{
    body::Bytes,
    extract::Query,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde::Deserialize;
use std::{sync::OnceLock, time::Duration};

const MAX_SIZE: usize = 4 << 20;

static PAYLOAD: OnceLock<Bytes> = OnceLock::new();
static RANDOM: OnceLock<Bytes> = OnceLock::new();

fn payload() -> &'static Bytes {
    PAYLOAD.get_or_init(|| (0..MAX_SIZE).map(|i| b'a' + (i % 26) as u8).collect::<Vec<u8>>().into())
}

// xorshift64*: несжимаемый буфер, одинаковый при каждом запуске (важно для повторяемости размера лога)
fn random() -> &'static Bytes {
    RANDOM.get_or_init(|| {
        let mut x: u64 = 0x9E37_79B9_7F4A_7C15;
        let mut v = Vec::with_capacity(MAX_SIZE);
        while v.len() < MAX_SIZE {
            x ^= x >> 12;
            x ^= x << 25;
            x ^= x >> 27;
            v.extend_from_slice(&x.wrapping_mul(0x2545_F491_4F6C_DD1D).to_le_bytes());
        }
        v.truncate(MAX_SIZE);
        v.into()
    })
}

#[derive(Deserialize)]
struct Params {
    size: Option<usize>,
    delay: Option<u64>,
    fill: Option<String>,
}

async fn delay(p: &Params) {
    if let Some(ms) = p.delay.filter(|&ms| ms > 0) {
        tokio::time::sleep(Duration::from_millis(ms)).await;
    }
}

async fn echo_get(Query(p): Query<Params>) -> Response {
    delay(&p).await;
    let n = p.size.filter(|&n| n > 0).unwrap_or(1024).min(MAX_SIZE);
    let buf = if p.fill.as_deref() == Some("random") { random() } else { payload() };
    (
        [(header::CONTENT_TYPE, "application/octet-stream")],
        buf.slice(..n),
    )
        .into_response()
}

async fn echo_post(Query(p): Query<Params>, headers: HeaderMap, body: Bytes) -> Response {
    delay(&p).await;
    let mut resp = body.into_response();
    if let Some(ct) = headers.get(header::CONTENT_TYPE) {
        resp.headers_mut().insert(header::CONTENT_TYPE, ct.clone());
    }
    resp
}

async fn health() -> (StatusCode, &'static str) {
    (StatusCode::OK, "ok")
}

#[tokio::main]
async fn main() {
    payload();
    random(); // прогреть буферы до первого запроса
    let app = Router::new()
        .route("/echo", get(echo_get).post(echo_post).put(echo_post))
        .route("/health", get(health));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("echo listening on :8080");
    axum::serve(listener, app).await.unwrap();
}
