# Rust concurrency examples

Small pieces of real code from my coursework that show common ways of writing
concurrent programs in Rust. The main project of the course (FTP client with a
GUI, in `../project`) is described in its own `EXPLANATION.md`. The files here
show other patterns that the project does not use.

| Folder / file | Pattern | Main tools |
|---|---|---|
| `tsp_threads/B2_insertion.rs` | embarrassingly parallel work, static split; measured speed-up | `std::thread::scope` |
| `tsp_threads/B2_ant.rs` | independent multi-start runs with different seeds | `std::thread::scope` |
| `tsp_threads/B2_evolution.rs` | the same, "islands" of a genetic algorithm without migration | `std::thread::scope` |
| `tsp_threads/B2_elastic.rs` | data parallelism, map-reduce inside a sequential loop | `std::thread::scope`, private buffers |
| `tsp_threads/B2_lk.rs` | fork-join rounds: all threads restart from the best result after a barrier | `std::thread::scope`, `join` as barrier |
| `echo/` | asynchronous HTTP server, tasks instead of threads | `tokio`, `axum`, `OnceLock`, `Bytes` |

## `tsp_threads/`: scoped threads

All five programs are heuristics for a travelling salesman problem with 2000
cities (homework of an algorithms course). The algorithms are not the point
here; the comments explain mainly the parallel parts.

What they have in common:

* **Scoped threads.** `std::thread::scope(|s| { ... s.spawn(...) ... })`
  joins every thread before it returns. Because of this guarantee the
  compiler lets the threads borrow local variables (the 2000x2000 distance
  matrix) by plain reference. Ordinary `std::thread::spawn` requires
  `'static` data, which would mean `Arc` or copying the matrix.
* **Shared data is read-only, mutable data is private.** Every thread gets
  `&` references to the common input and owns its working state (tour,
  pheromone matrix, population, random generator). There are no locks or
  atomics at all, and the compiler checks this: a thread cannot get a `&mut`
  to data that other threads can see.
* **Results through `join`.** Each thread returns a value, and
  `JoinHandle::join` hands it to the main thread. The merging (choosing the
  best tour, summing forces) happens on the main thread after the join.
* **Deterministic randomness.** Each thread creates its own small generator
  from a seed, so there is no shared generator and runs are repeatable.

The patterns differ in how the work is divided:

1. `B2_insertion.rs`: 2000 equal, independent tasks split round-robin between
   8 threads. It prints the time of one run and of all runs, so the speed-up
   can be shown directly.
2. `B2_ant.rs`, `B2_evolution.rs`: a few long independent searches with
   different seeds, one thread each, each limited by wall-clock time. The
   best result wins.
3. `B2_elastic.rs`: one computation per iteration is split by data. Every
   thread accumulates its part into a private buffer, the main thread adds
   the buffers (reduce). The end of the scope is the barrier between
   iterations, and only then is the shared state updated.
4. `B2_lk.rs` (rounds mode): all threads start from the same best tour with
   different seeds, run for a fixed time, are joined, and the best result
   becomes the start of the next round. Progress is shared between threads
   without any synchronisation during the search.

These files are copied from a larger crate and **do not compile on their
own**: they use helper functions (`load_points`, `point_distances`,
`tour_length`, `save_ids`) from the homework library and its input data.
They are meant to be read and shown as code fragments.

## `echo/`: async I/O with tokio

A minimal HTTP echo service used for load tests in a distributed systems
seminar. It shows the other model of concurrency: instead of one OS thread
per connection, `#[tokio::main]` starts a pool of worker threads (one per
core) and every request is a lightweight task. A task gives its thread back
at every `.await`.

Points worth showing:

* `tokio::time::sleep(...).await` suspends only the task, while
  `std::thread::sleep` would block a whole worker thread;
* `OnceLock` initialises a global buffer exactly once, safely from many
  threads, and after that it is read without locking;
* `Bytes::slice` gives every response a view into the shared buffer without
  copying (reference counting).

This one is a complete crate:

```
cd echo
cargo run --release
curl "http://localhost:8080/echo?size=16"
```

## Comparison with the course project

| | FTP client (`../project`) | `tsp_threads` | `echo` |
|---|---|---|---|
| Unit of concurrency | OS thread per download | OS thread per job, created in a scope | async task on a thread pool |
| Communication | shared state: atomics, `Mutex`, `AtomicBool` for cancel | none during work, results via `join` | none, requests are independent |
| Lifetime of threads | long, detached | bounded by `thread::scope` | managed by the runtime |
| Typical use | I/O in the background of a GUI | CPU-bound computation | many concurrent network connections |
