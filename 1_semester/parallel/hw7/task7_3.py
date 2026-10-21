import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import argparse
import csv
import sys

import numpy as np
from mpi4py import MPI

from task7_1 import ring_matrix_multiplication
from task7_2 import ring_matrix_multiplication_nb
from task7_bonus_a import ring_matrix_multiplication_circulate_A

METHODS = {
    "blocking": ring_matrix_multiplication,
    "nonblocking": ring_matrix_multiplication_nb,
    "circulate_A": ring_matrix_multiplication_circulate_A,
}


def distribute(comm, A, B, N):
    rank, P = comm.Get_rank(), comm.Get_size()
    n = N // P
    A_rowbl = np.empty((n, N), dtype=np.float64)
    BT_rowbl = np.empty((n, N), dtype=np.float64)
    comm.Scatter(A, A_rowbl, root=0)
    comm.Scatter(np.ascontiguousarray(B.T) if rank == 0 else None, BT_rowbl, root=0)
    return A_rowbl, np.ascontiguousarray(BT_rowbl.T)


def timed(comm, func, A_rowbl, B_colbl):
    comm.Barrier()
    t0 = MPI.Wtime()
    C = func(A_rowbl, B_colbl)
    local = MPI.Wtime() - t0
    return comm.reduce(local, op=MPI.MAX, root=0), C


def main():
    parser = argparse.ArgumentParser(description="Assignment 7.3: ring matrix multiplication timings.")
    parser.add_argument("--N", type=int, nargs="+", default=[512, 1024, 2048])
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--methods", default="blocking,nonblocking", help="comma-separated subset of: " + ",".join(METHODS))
    parser.add_argument("--csv", default="results.csv")
    args = parser.parse_args()

    comm = MPI.COMM_WORLD
    rank, P = comm.Get_rank(), comm.Get_size()
    rows = []

    for N in args.N:
        if N % P != 0:
            if rank == 0:
                print(f"skip N={N}: not divisible by P={P}", flush=True)
            continue
        if rank == 0:
            rng = np.random.default_rng(2026)
            A = rng.random((N, N))
            B = rng.random((N, N))
            C_ref = A @ B
        else:
            A = B = C_ref = None

        comm.Barrier()
        t0 = MPI.Wtime()
        A_rowbl, B_colbl = distribute(comm, A, B, N)
        setup = comm.reduce(MPI.Wtime() - t0, op=MPI.MAX, root=0)

        for method in args.methods.split(","):
            func = METHODS[method]
            _, C = timed(comm, func, A_rowbl, B_colbl)
            if rank == 0:
                try:
                    np.testing.assert_allclose(C, C_ref, rtol=1e-10, atol=1e-12)
                except AssertionError as exc:
                    print(f"[FAIL] {method} N={N}: {exc}", flush=True)
                    comm.Abort(1)

            times = []
            for run in range(args.runs):
                t, _ = timed(comm, func, A_rowbl, B_colbl)
                if rank == 0:
                    times.append(t)
                    rows.append([method, P, N, run, t, setup])

            if rank == 0:
                gflops = 2 * N ** 3 / np.median(times) / 1e9
                print(f"{method:12s} P={P:3d} N={N:5d}  median {np.median(times):.4f}s  "
                      f"(min {min(times):.4f} / max {max(times):.4f}, {args.runs} runs)  "
                      f"{gflops:6.2f} GFLOP/s  setup {setup:.4f}s", flush=True)

    if rank == 0:
        new_file = not os.path.exists(args.csv)
        with open(args.csv, "a", newline="") as f:
            w = csv.writer(f)
            if new_file:
                w.writerow(["method", "P", "N", "run", "time", "setup"])
            w.writerows(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
