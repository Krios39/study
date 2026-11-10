# FTP client: explanation

## What it does

A desktop GUI with a URL field, a **Download** button and one progress bar per
download. The URL can be a full address (`ftp://ftp.bmrb.io/pdb/holdings/refdata_id_list.json.gz`)
or just a file name (`refdata_id_list.json.gz`), which is then looked up in
`ftp.bmrb.io/pdb/holdings`. Pressing the button (or Enter) starts the download
at once and clears the field, so the next download can be started right away.
Files are saved into `downloads/` next to the working directory.

Each row shows the file name, a progress bar (percentage), downloaded/total
size, speed and an estimate of the remaining time. Running downloads can be
cancelled; failed or cancelled ones can be retried or removed from the list.

## Libraries

| Library | Purpose |
|---|---|
| `eframe` / `egui` 0.37 | immediate-mode GUI |
| `suppaftp` 12.2 | FTP protocol (synchronous client) |
| Rust standard library | threads, atomics, mutex, sockets, files |

Build and run: `cargo run --release`. Tests: `cargo test`.

## Concurrency design

* **One worker thread per download** (`std::thread::spawn` in `download::spawn`).
  The GUI thread only parses the URL and spawns the thread, so it never waits
  for the network and the interface stays fluid during any number of downloads.
* **Shared state** (`DownloadState`) is passed to the worker in an `Arc`:
  * byte counters (`downloaded`, `total`, `speed`) are `AtomicU64`. The worker
    increments them after each 64 KB chunk and the GUI reads them every frame,
    with no locks and no blocking on either side;
  * the status (connecting / downloading / retrying / done / failed / cancelled)
    is a `Mutex<Status>`, as it carries a string and changes rarely;
  * cancellation is an `AtomicBool` set by the GUI and checked by the worker
    between two reads (cooperative cancellation; the worker then sends `ABOR`).
* **Repaints**: the worker calls a callback that runs `egui::Context::request_repaint()`
  (egui's context is thread safe), at most 10 times per second, so the bars
  update smoothly without flooding the GUI. The worker never touches GUI objects.

## Error handling

* **Invalid URL** (empty, not `ftp://`, points to a directory, bad port): shown
  under the URL field, no thread is started.
* **Non-existing URL**: an unknown host (DNS lookup fails) or a missing file
  (server replies `550`) fails immediately with a clear message, as retrying
  cannot help.
* **Lost connection**: all sockets have a 10 s connect timeout and a 15 s read
  timeout, so a dead connection becomes an error instead of a hung thread. A
  connection reset, timeout or a transfer that ends early is retried up to
  3 times. Data is written to `<name>.part`, and the next attempt **resumes**
  from its size with the FTP `REST` command. The file is renamed to its final
  name only when it is complete.
* The same file cannot be downloaded twice at the same time (both threads would
  write into one file).

## Testing

`tests/download.rs` starts a small FTP server on localhost and checks a normal
download, a missing file, an unknown host, a refused connection, a connection
lost in the middle (the download is resumed from the right offset), cancellation
and five parallel downloads.
