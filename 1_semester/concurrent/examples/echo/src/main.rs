//! Echo service used for load measurements: almost zero processing time,
//! the client chooses the size of the response.
//!
//!   GET  /echo?size=N[&fill=random][&delay=MS]
//!        -> N bytes (default 1024, at most 4 MiB), optional delay of MS ms;
//!           fill=random gives incompressible pseudo-random bytes
//!           (deterministic), otherwise the bytes are abcdef...
//!   POST /echo[?delay=MS]         -> the request body unchanged
//!   GET  /health                  -> ok
//!
//! Concurrency model: asynchronous I/O instead of one thread per connection.
//! `#[tokio::main]` starts a multi-threaded runtime with a small pool of
//! worker threads (one per CPU core). Every HTTP request is a lightweight
//! task (a future) scheduled on this pool, so thousands of open connections
//! do not need thousands of OS threads. A task gives its thread back to the
//! pool at every `.await` (waiting for the network or a timer), and the
//! thread then runs other tasks.

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

// Response buffers shared by all tasks on all worker threads. `OnceLock`
// guarantees that the buffer is initialised exactly once, even if several
// threads ask for it at the same moment; afterwards it is read without any
// locking. `Bytes` is a reference-counted immutable buffer, so `slice()`
// below hands out a view into it without copying the data.
static PAYLOAD: OnceLock<Bytes> = OnceLock::new();
static RANDOM: OnceLock<Bytes> = OnceLock::new();

fn payload() -> &'static Bytes {
    PAYLOAD.get_or_init(|| (0..MAX_SIZE).map(|i| b'a' + (i % 26) as u8).collect::<Vec<u8>>().into())
}

// xorshift64*: an incompressible buffer that is the same on every start
// (important so that log sizes are repeatable between measurements).
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

/// Query parameters, parsed by axum from the URL.
#[derive(Deserialize)]
struct Params {
    size: Option<usize>,
    delay: Option<u64>,
    fill: Option<String>,
}

/// Simulated processing time. `tokio::time::sleep` does not block the worker
/// thread: the task is suspended and the thread serves other requests in the
/// meantime. `std::thread::sleep` here would block a whole worker thread and
/// stall every task scheduled on it.
async fn delay(p: &Params) {
    if let Some(ms) = p.delay.filter(|&ms| ms > 0) {
        tokio::time::sleep(Duration::from_millis(ms)).await;
    }
}

/// GET /echo: returns `size` bytes from one of the shared buffers.
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

// POST with ?size=N answers N bytes like GET: the request size (body) and
// the response size can be chosen independently.
async fn echo_post(Query(p): Query<Params>, headers: HeaderMap, body: Bytes) -> Response {
    if p.size.is_some() {
        return echo_get(Query(p)).await;
    }
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

// The macro turns `main` into a function that creates the tokio runtime
// (multi-threaded scheduler) and runs this async body on it.
#[tokio::main]
async fn main() {
    payload();
    random(); // fill the buffers before the first request arrives
    let app = Router::new()
        .route("/echo", get(echo_get).post(echo_post).put(echo_post))
        .route("/health", get(health));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("echo listening on :8080");
    // Accept loop: every accepted connection is spawned as a separate task.
    axum::serve(listener, app).await.unwrap();
}
