//! Download engine: everything that runs on the worker threads.
//!
//! Every download gets its own OS thread (`std::thread`). The GUI thread and a
//! worker thread share exactly one object, [`DownloadState`], through an `Arc`:
//!
//! * the byte counters are atomics, so the worker can update them on every
//!   received chunk without locking and the GUI can read them on every frame
//!   without ever blocking;
//! * the human readable status is behind a `Mutex`, because it is a `String`
//!   inside an enum and changes only a few times per download;
//! * cancellation is an `AtomicBool` that the GUI sets and the worker polls
//!   between two reads from the network.
//!
//! The worker never touches GUI objects. When something worth showing happens
//! it only calls the `notify` callback, which asks egui to repaint.

use std::fs::{self, File, OpenOptions};
use std::io::{self, ErrorKind, Read, Write};
use std::net::{Shutdown, SocketAddr, TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use suppaftp::types::FileType;
use suppaftp::{FtpError, FtpStream, Mode, Status as FtpStatus};

/// Server and directory used when the user types only a file name.
pub const DEFAULT_BASE: &str = "ftp://ftp.bmrb.io/pdb/holdings/";

/// Maximal time to establish a TCP connection (control or data).
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
/// If no byte arrives for this long the connection is considered lost.
const READ_TIMEOUT: Duration = Duration::from_secs(15);
/// How many times a download is tried before it is reported as failed.
const MAX_ATTEMPTS: u32 = 3;
/// Pause between two attempts.
const RETRY_DELAY: Duration = Duration::from_secs(3);
/// Minimal interval between two repaint requests sent to the GUI.
const NOTIFY_INTERVAL: Duration = Duration::from_millis(100);
/// Size of the buffer used for reading from the data connection.
const CHUNK: usize = 64 * 1024;

/// A parsed `ftp://host[:port]/path/to/file` address.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FtpUrl {
    pub host: String,
    pub port: u16,
    /// Absolute path of the file on the server, e.g. `/pdb/holdings/a.json.gz`.
    pub path: String,
    /// Last path component, used as the local file name.
    pub file_name: String,
}

impl FtpUrl {
    /// Parses user input.
    ///
    /// Accepted forms:
    /// * `ftp://host/dir/file`, `ftp://host:2121/dir/file`
    /// * `host/dir/file` (the `ftp://` prefix is added)
    /// * `file` (only a name, it is looked up in [`DEFAULT_BASE`])
    pub fn parse(input: &str) -> Result<FtpUrl, String> {
        let input = input.trim();
        if input.is_empty() {
            return Err("URL is empty".into());
        }
        let full = if input.contains("://") {
            input.to_string()
        } else if !input.contains('/') {
            format!("{DEFAULT_BASE}{input}")
        } else {
            format!("ftp://{input}")
        };

        let (scheme, rest) = full.split_once("://").unwrap();
        if !scheme.eq_ignore_ascii_case("ftp") {
            return Err(format!("unsupported scheme '{scheme}', only ftp:// is supported"));
        }
        let (authority, path) = match rest.find('/') {
            Some(i) => (&rest[..i], &rest[i..]),
            None => (rest, ""),
        };
        // Optional "user@" part is ignored, the client always logs in anonymously.
        let authority = authority.rsplit('@').next().unwrap_or(authority);
        let (host, port) = match authority.rsplit_once(':') {
            Some((h, p)) => (h, p.parse::<u16>().map_err(|_| format!("invalid port '{p}'"))?),
            None => (authority, 21),
        };
        if host.is_empty() {
            return Err("host name is missing".into());
        }
        let file_name = path.rsplit('/').next().unwrap_or("");
        if file_name.is_empty() {
            return Err("URL must point to a file, not to a directory".into());
        }
        Ok(FtpUrl {
            host: host.to_string(),
            port,
            path: path.to_string(),
            file_name: file_name.to_string(),
        })
    }
}

/// Life cycle of one download as shown in the GUI.
#[derive(Debug, Clone, PartialEq)]
pub enum Status {
    Connecting,
    Downloading,
    /// The connection was lost; waiting before the next attempt.
    Retrying { attempt: u32, reason: String },
    Done { path: PathBuf },
    Failed(String),
    Cancelled,
}

impl Status {
    /// `true` while the worker thread is still running.
    pub fn is_active(&self) -> bool {
        matches!(self, Status::Connecting | Status::Downloading | Status::Retrying { .. })
    }
}

/// State shared between the GUI thread and one worker thread.
pub struct DownloadState {
    pub url: FtpUrl,
    /// Bytes already stored in the local file.
    downloaded: AtomicU64,
    /// File size reported by the server, 0 while unknown.
    total: AtomicU64,
    /// Average speed of the current attempt in bytes per second.
    speed: AtomicU64,
    /// Set by the GUI, polled by the worker.
    cancel: AtomicBool,
    status: Mutex<Status>,
}

impl DownloadState {
    pub fn new(url: FtpUrl) -> Self {
        DownloadState {
            url,
            downloaded: AtomicU64::new(0),
            total: AtomicU64::new(0),
            speed: AtomicU64::new(0),
            cancel: AtomicBool::new(false),
            status: Mutex::new(Status::Connecting),
        }
    }

    pub fn downloaded(&self) -> u64 {
        self.downloaded.load(Ordering::Relaxed)
    }

    /// `None` while the size is unknown.
    pub fn total(&self) -> Option<u64> {
        Some(self.total.load(Ordering::Relaxed)).filter(|&t| t > 0)
    }

    pub fn speed(&self) -> u64 {
        self.speed.load(Ordering::Relaxed)
    }

    /// Fraction in `0..=1`, or `None` when the size is unknown.
    pub fn fraction(&self) -> Option<f32> {
        self.total().map(|t| (self.downloaded() as f64 / t as f64).min(1.0) as f32)
    }

    pub fn status(&self) -> Status {
        self.status.lock().unwrap().clone()
    }

    fn set_status(&self, s: Status) {
        *self.status.lock().unwrap() = s;
    }

    /// Requests cancellation; the worker stops at the next chunk.
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::Relaxed);
    }

    fn is_cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }
}

/// Callback used by a worker to ask the GUI for a repaint.
pub type Notify = Arc<dyn Fn() + Send + Sync>;

/// Creates the shared state and starts a worker thread for it.
///
/// Returns immediately, so the GUI stays responsive and the user can start
/// the next download right away.
pub fn spawn(url: FtpUrl, dest_dir: PathBuf, notify: Notify) -> Arc<DownloadState> {
    let state = Arc::new(DownloadState::new(url));
    let worker_state = Arc::clone(&state);
    thread::Builder::new()
        .name(format!("download {}", state.url.file_name))
        .spawn(move || run(&worker_state, &dest_dir, &notify))
        .expect("failed to start a download thread");
    state
}

/// Result of one failed attempt, decides whether another attempt makes sense.
#[derive(Debug)]
enum Failure {
    /// Retrying will not help (unknown host, missing file, local disk error...).
    Fatal(String),
    /// Network problem, the download is retried and resumed.
    Retryable(String),
    Cancelled,
}

/// Body of a worker thread: tries the download up to [`MAX_ATTEMPTS`] times.
pub fn run(state: &DownloadState, dest_dir: &Path, notify: &Notify) {
    let final_path = dest_dir.join(&state.url.file_name);
    // Data is written into "<name>.part" and renamed only when complete, so a
    // half downloaded file is never mistaken for a finished one.
    let part_path = dest_dir.join(format!("{}.part", state.url.file_name));

    let mut attempt = 1;
    let result = loop {
        match try_download(state, &part_path, notify) {
            Ok(()) => break Ok(()),
            Err(Failure::Retryable(reason)) if attempt < MAX_ATTEMPTS => {
                state.set_status(Status::Retrying { attempt, reason });
                notify();
                // Sleep in short steps so that Cancel reacts quickly.
                let until = Instant::now() + RETRY_DELAY;
                while Instant::now() < until && !state.is_cancelled() {
                    thread::sleep(Duration::from_millis(50));
                }
                if state.is_cancelled() {
                    break Err(Failure::Cancelled);
                }
                attempt += 1;
                state.set_status(Status::Connecting);
                notify();
            }
            Err(e) => break Err(e),
        }
    };

    let status = match result {
        Ok(()) => match fs::rename(&part_path, &final_path) {
            Ok(()) => Status::Done { path: final_path },
            Err(e) => Status::Failed(format!("cannot rename the downloaded file: {e}")),
        },
        Err(Failure::Cancelled) => {
            let _ = fs::remove_file(&part_path);
            Status::Cancelled
        }
        Err(Failure::Fatal(msg)) | Err(Failure::Retryable(msg)) => Status::Failed(msg),
    };
    state.speed.store(0, Ordering::Relaxed);
    state.set_status(status);
    notify();
}

/// One attempt: connect, log in, ask for the size and receive the file.
///
/// If `part_path` already contains data from a previous attempt, the transfer
/// is resumed with the FTP `REST` command instead of starting from zero.
fn try_download(state: &DownloadState, part_path: &Path, notify: &Notify) -> Result<(), Failure> {
    let url = &state.url;
    state.set_status(Status::Connecting);
    notify();

    // --- control connection -------------------------------------------------
    let addrs = resolve(&url.host, url.port)?;
    let control = connect_any(&addrs).map_err(|e| {
        Failure::Retryable(format!("cannot connect to {}:{}: {}", url.host, url.port, io_msg(&e)))
    })?;
    let is_ipv6 = control.peer_addr().map(|a| a.is_ipv6()).unwrap_or(false);
    // Second handle to the same socket. Shutting it down unblocks the library
    // immediately when the transfer has to be abandoned.
    let control_handle = control.try_clone().map_err(|e| Failure::Fatal(e.to_string()))?;

    let mut ftp = FtpStream::connect_with_stream(control)
        .map_err(|e| Failure::Retryable(ftp_msg("server did not answer", &e)))?
        // Data connections get the same timeouts as the control connection.
        .passive_stream_builder(|addr| connect(addr).map_err(FtpError::ConnectionError));
    if is_ipv6 {
        // PASV can only describe IPv4 addresses; over IPv6 the extended
        // passive mode (EPSV, RFC 2428) is required.
        ftp.set_mode(Mode::ExtendedPassive);
    } else {
        // Some servers announce a private address in the PASV reply; use the
        // address of the control connection instead.
        ftp.set_passive_nat_workaround(true);
    }

    ftp.login("anonymous", "anonymous@").map_err(|e| match &e {
        // 530: the server does not accept anonymous users, retrying is useless.
        FtpError::UnexpectedResponse(r) if r.status == FtpStatus::NotLoggedIn => {
            Failure::Fatal(ftp_msg("login failed", &e))
        }
        // e.g. 421 "too many users": may work a bit later.
        _ => Failure::Retryable(ftp_msg("login failed", &e)),
    })?;
    ftp.transfer_type(FileType::Binary)
        .map_err(|e| Failure::Retryable(ftp_msg("TYPE I failed", &e)))?;

    // --- size and resume offset --------------------------------------------
    let total = match ftp.size(&url.path) {
        Ok(n) => n as u64,
        Err(e) if is_not_found(&e) => {
            return Err(Failure::Fatal(format!("file not found on server: {}", url.path)))
        }
        Err(FtpError::ConnectionError(e)) => {
            return Err(Failure::Retryable(format!("connection lost: {}", io_msg(&e))))
        }
        // SIZE is optional in FTP; without it the progress bar is indeterminate.
        Err(_) => 0,
    };
    state.total.store(total, Ordering::Relaxed);

    let mut offset = fs::metadata(part_path).map(|m| m.len()).unwrap_or(0);
    if total > 0 && offset > total {
        offset = 0; // the file changed on the server, start again
    }
    state.downloaded.store(offset, Ordering::Relaxed);
    if total > 0 && offset == total {
        let _ = ftp.quit();
        return Ok(());
    }

    let mut file = open_part(part_path, offset).map_err(|e| {
        Failure::Fatal(format!("cannot write {}: {e}", part_path.display()))
    })?;

    // --- transfer ------------------------------------------------------------
    if offset > 0 {
        ftp.resume_transfer(offset as usize).ok();
    }
    let mut stream = match ftp.retr_as_stream(&url.path) {
        Ok(s) => s,
        Err(e) if is_not_found(&e) => {
            return Err(Failure::Fatal(format!("file not found on server: {}", url.path)))
        }
        Err(e) => {
            if offset > 0 {
                // Maybe the server does not support REST: next attempt from zero.
                let _ = fs::remove_file(part_path);
            }
            return Err(Failure::Retryable(ftp_msg("cannot start the transfer", &e)));
        }
    };
    state.set_status(Status::Downloading);
    notify();

    let started = Instant::now();
    let mut received_now: u64 = 0; // bytes of this attempt, used for the speed
    let mut last_notify = Instant::now();
    let mut buf = vec![0u8; CHUNK];
    loop {
        if state.is_cancelled() {
            // ABOR tells the server to stop sending; errors do not matter here.
            let _ = control_handle.set_read_timeout(Some(Duration::from_secs(3)));
            let _ = ftp.abort(stream);
            let _ = ftp.quit();
            return Err(Failure::Cancelled);
        }
        let n = match stream.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => n,
            Err(e) if e.kind() == ErrorKind::Interrupted => continue,
            Err(e) => {
                // Close the control socket first, otherwise dropping the
                // stream would wait for a reply that never comes.
                let _ = control_handle.shutdown(Shutdown::Both);
                drop(stream);
                let _ = file.flush();
                return Err(Failure::Retryable(format!("connection lost: {}", io_msg(&e))));
            }
        };
        file.write_all(&buf[..n])
            .map_err(|e| Failure::Fatal(format!("cannot write {}: {e}", part_path.display())))?;
        received_now += n as u64;
        state.downloaded.fetch_add(n as u64, Ordering::Relaxed);

        // Do not flood the GUI: at most ten repaint requests per second.
        if last_notify.elapsed() >= NOTIFY_INTERVAL {
            let secs = started.elapsed().as_secs_f64().max(0.001);
            state.speed.store((received_now as f64 / secs) as u64, Ordering::Relaxed);
            last_notify = Instant::now();
            notify();
        }
    }
    file.flush().map_err(|e| Failure::Fatal(e.to_string()))?;

    // The server confirms the end of the transfer on the control connection.
    if let Err(e) = stream.finish() {
        return Err(Failure::Retryable(ftp_msg("transfer was not completed", &e)));
    }
    let _ = ftp.quit();

    let have = state.downloaded();
    if total > 0 && have < total {
        return Err(Failure::Retryable(format!(
            "connection closed early ({have} of {total} bytes)"
        )));
    }
    Ok(())
}

/// DNS lookup. An unknown host is a fatal error: retrying will not fix it.
///
/// IPv4 addresses come first: plain passive mode (PASV) works only over
/// IPv4 and is supported by every FTP server.
fn resolve(host: &str, port: u16) -> Result<Vec<SocketAddr>, Failure> {
    let mut addrs: Vec<SocketAddr> = (host, port)
        .to_socket_addrs()
        .map(|a| a.collect())
        .unwrap_or_default();
    if addrs.is_empty() {
        return Err(Failure::Fatal(format!("host '{host}' not found")));
    }
    addrs.sort_by_key(|a| a.is_ipv6());
    Ok(addrs)
}

/// Tries the addresses of a host one by one, returns the first connection.
fn connect_any(addrs: &[SocketAddr]) -> io::Result<TcpStream> {
    let mut last_err = io::Error::new(ErrorKind::NotFound, "no address");
    for &addr in addrs {
        match connect(addr) {
            Ok(s) => return Ok(s),
            Err(e) => last_err = e,
        }
    }
    Err(last_err)
}

/// TCP connection with connect, read and write timeouts.
///
/// The read timeout is what turns a silently dead connection (cable pulled,
/// Wi-Fi lost) into an error instead of a thread blocked forever.
fn connect(addr: SocketAddr) -> io::Result<TcpStream> {
    let s = TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT)?;
    s.set_read_timeout(Some(READ_TIMEOUT))?;
    s.set_write_timeout(Some(READ_TIMEOUT))?;
    Ok(s)
}

/// Opens the `.part` file: appends when resuming, truncates otherwise.
fn open_part(path: &Path, offset: u64) -> io::Result<File> {
    if offset > 0 {
        OpenOptions::new().append(true).open(path)
    } else {
        File::create(path)
    }
}

/// `550 File not available` is how FTP servers report a missing file.
fn is_not_found(e: &FtpError) -> bool {
    matches!(e, FtpError::UnexpectedResponse(r) if r.status == FtpStatus::FileUnavailable)
}

fn ftp_msg(context: &str, e: &FtpError) -> String {
    match e {
        FtpError::ConnectionError(io) => format!("{context}: {}", io_msg(io)),
        FtpError::UnexpectedResponse(r) => format!(
            "{context}: server replied {} {}",
            r.status.code(),
            String::from_utf8_lossy(&r.body).trim()
        ),
        other => format!("{context}: {other}"),
    }
}

/// Short, user friendly description of an I/O error.
fn io_msg(e: &io::Error) -> String {
    match e.kind() {
        ErrorKind::TimedOut | ErrorKind::WouldBlock => "no response (timeout)".into(),
        ErrorKind::ConnectionRefused => "connection refused".into(),
        ErrorKind::ConnectionReset | ErrorKind::ConnectionAborted => "connection reset".into(),
        _ => e.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_full_url() {
        let u = FtpUrl::parse("ftp://ftp.bmrb.io/pdb/holdings/a.json.gz").unwrap();
        assert_eq!(u.host, "ftp.bmrb.io");
        assert_eq!(u.port, 21);
        assert_eq!(u.path, "/pdb/holdings/a.json.gz");
        assert_eq!(u.file_name, "a.json.gz");
    }

    #[test]
    fn parse_short_forms() {
        let u = FtpUrl::parse("  refdata_id_list.json.gz ").unwrap();
        assert_eq!(u.path, "/pdb/holdings/refdata_id_list.json.gz");
        let u = FtpUrl::parse("localhost:2121/x/y.bin").unwrap();
        assert_eq!((u.host.as_str(), u.port, u.path.as_str()), ("localhost", 2121, "/x/y.bin"));
    }

    #[test]
    fn parse_errors() {
        assert!(FtpUrl::parse("").is_err());
        assert!(FtpUrl::parse("http://x/y").is_err());
        assert!(FtpUrl::parse("ftp://host/dir/").is_err());
        assert!(FtpUrl::parse("ftp://host:abc/f").is_err());
    }
}
