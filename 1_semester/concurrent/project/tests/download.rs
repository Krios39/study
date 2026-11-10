//! Tests of the download engine against a tiny FTP server running on localhost.
//!
//! The mock server understands just enough FTP for the client (USER, PASS,
//! TYPE, SIZE, PASV, REST, RETR, ABOR, QUIT) and can simulate failures:
//! * `missing.bin` does not exist (550);
//! * `drop.bin` loses the connection in the middle of the first transfer;
//! * `slow.bin` is sent slowly, so the download can be cancelled.

use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use ftp_client::download::{self, DownloadState, FtpUrl, Notify, Status};

const SIZE: usize = 1_000_000;

fn content() -> Vec<u8> {
    (0..SIZE).map(|i| (i * 7 % 251) as u8).collect()
}

/// What the mock server observed, used by the assertions.
#[derive(Default)]
struct Log {
    connections: AtomicUsize,
    rest_offsets: Mutex<Vec<usize>>,
}

/// Starts the mock server and returns its port.
fn server() -> (u16, Arc<Log>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let log = Arc::new(Log::default());
    let l = Arc::clone(&log);
    thread::spawn(move || {
        for conn in listener.incoming().flatten() {
            let n = l.connections.fetch_add(1, Ordering::SeqCst);
            let l = Arc::clone(&l);
            thread::spawn(move || session(conn, n, &l));
        }
    });
    (port, log)
}

fn session(ctrl: TcpStream, conn_no: usize, log: &Log) {
    let data = content();
    let mut out = ctrl.try_clone().unwrap();
    let mut reader = BufReader::new(ctrl);
    let mut pasv: Option<TcpListener> = None;
    let mut offset = 0usize;
    let _ = write!(out, "220 mock ready\r\n");
    let mut line = String::new();
    loop {
        line.clear();
        if reader.read_line(&mut line).unwrap_or(0) == 0 {
            return;
        }
        let (cmd, arg) = line.trim_end().split_once(' ').unwrap_or((line.trim_end(), ""));
        let exists = !arg.ends_with("missing.bin");
        let reply = match cmd.to_ascii_uppercase().as_str() {
            "USER" => "331 password please".to_string(),
            "PASS" => "230 logged in".into(),
            "TYPE" => "200 ok".into(),
            "SIZE" if exists => format!("213 {SIZE}"),
            "SIZE" | "RETR" if !exists => "550 no such file".into(),
            "PASV" => {
                let l = TcpListener::bind("127.0.0.1:0").unwrap();
                let p = l.local_addr().unwrap().port();
                pasv = Some(l);
                format!("227 Entering Passive Mode (127,0,0,1,{},{})", p / 256, p % 256)
            }
            "REST" => {
                offset = arg.parse().unwrap();
                log.rest_offsets.lock().unwrap().push(offset);
                "350 restarting".into()
            }
            "RETR" => {
                let _ = write!(out, "150 opening data connection\r\n");
                let (mut d, _) = pasv.take().unwrap().accept().unwrap();
                let body = &data[offset..];
                if arg.ends_with("drop.bin") && conn_no == 0 {
                    // Simulated lost connection: half of the file, then both sockets die.
                    let _ = d.write_all(&body[..body.len() / 2]);
                    return;
                }
                let delay = arg.ends_with("slow.bin");
                for chunk in body.chunks(16 * 1024) {
                    if d.write_all(chunk).is_err() {
                        break;
                    }
                    if delay {
                        thread::sleep(Duration::from_millis(50));
                    }
                }
                drop(d);
                offset = 0;
                "226 transfer complete".into()
            }
            "ABOR" => "226 aborted".into(),
            "QUIT" => {
                let _ = write!(out, "221 bye\r\n");
                return;
            }
            _ => "502 not implemented".into(),
        };
        let _ = write!(out, "{reply}\r\n");
    }
}

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("ftp_client_test_{name}_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn notify() -> Notify {
    Arc::new(|| {})
}

/// Runs a download to completion on the current thread.
fn download(url: &str, dir: &Path) -> DownloadState {
    let state = DownloadState::new(FtpUrl::parse(url).unwrap());
    download::run(&state, dir, &notify());
    state
}

#[test]
fn downloads_a_file() {
    let (port, _) = server();
    let dir = temp_dir("ok");
    let s = download(&format!("ftp://127.0.0.1:{port}/data/ok.bin"), &dir);
    assert!(matches!(s.status(), Status::Done { .. }), "{:?}", s.status());
    assert_eq!(std::fs::read(dir.join("ok.bin")).unwrap(), content());
    assert!(!dir.join("ok.bin.part").exists());
    assert_eq!(s.fraction(), Some(1.0));
}

#[test]
fn missing_file_fails_without_retry() {
    let (port, log) = server();
    let dir = temp_dir("missing");
    let s = download(&format!("ftp://127.0.0.1:{port}/data/missing.bin"), &dir);
    match s.status() {
        Status::Failed(msg) => assert!(msg.contains("not found"), "{msg}"),
        other => panic!("{other:?}"),
    }
    assert_eq!(log.connections.load(Ordering::SeqCst), 1);
}

#[test]
fn unknown_host_fails() {
    let dir = temp_dir("host");
    let s = download("ftp://no-such-host.invalid/x.bin", &dir);
    match s.status() {
        Status::Failed(msg) => assert!(msg.contains("not found"), "{msg}"),
        other => panic!("{other:?}"),
    }
}

#[test]
fn refused_connection_is_retried_then_fails() {
    // Bind and drop a listener to get a port where nobody listens.
    let port = TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
    let dir = temp_dir("refused");
    let s = download(&format!("ftp://127.0.0.1:{port}/x.bin"), &dir);
    assert!(matches!(s.status(), Status::Failed(_)), "{:?}", s.status());
}

#[test]
fn lost_connection_is_resumed() {
    let (port, log) = server();
    let dir = temp_dir("drop");
    let s = download(&format!("ftp://127.0.0.1:{port}/data/drop.bin"), &dir);
    assert!(matches!(s.status(), Status::Done { .. }), "{:?}", s.status());
    assert_eq!(std::fs::read(dir.join("drop.bin")).unwrap(), content());
    assert_eq!(log.connections.load(Ordering::SeqCst), 2);
    // Second attempt continued from where the first one stopped.
    assert_eq!(*log.rest_offsets.lock().unwrap(), vec![SIZE / 2]);
}

#[test]
fn download_can_be_cancelled() {
    let (port, _) = server();
    let dir = temp_dir("cancel");
    let url = FtpUrl::parse(&format!("ftp://127.0.0.1:{port}/data/slow.bin")).unwrap();
    let s = download::spawn(url, dir.clone(), notify());
    let start = Instant::now();
    while s.downloaded() == 0 {
        assert!(start.elapsed() < Duration::from_secs(10));
        thread::sleep(Duration::from_millis(20));
    }
    s.cancel();
    while s.status().is_active() {
        assert!(start.elapsed() < Duration::from_secs(10));
        thread::sleep(Duration::from_millis(20));
    }
    assert_eq!(s.status(), Status::Cancelled);
    assert!(!dir.join("slow.bin.part").exists());
    assert!(!dir.join("slow.bin").exists());
}

#[test]
fn many_downloads_in_parallel() {
    let (port, _) = server();
    let dir = temp_dir("parallel");
    let states: Vec<_> = (0..5)
        .map(|i| {
            let url = FtpUrl::parse(&format!("ftp://127.0.0.1:{port}/data/f{i}.bin")).unwrap();
            download::spawn(url, dir.clone(), notify())
        })
        .collect();
    let start = Instant::now();
    while states.iter().any(|s| s.status().is_active()) {
        assert!(start.elapsed() < Duration::from_secs(20));
        thread::sleep(Duration::from_millis(20));
    }
    for (i, s) in states.iter().enumerate() {
        assert!(matches!(s.status(), Status::Done { .. }), "{:?}", s.status());
        assert_eq!(std::fs::read(dir.join(format!("f{i}.bin"))).unwrap(), content());
    }
}
