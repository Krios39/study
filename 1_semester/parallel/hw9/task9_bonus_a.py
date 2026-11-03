import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import argparse
import csv

import numpy as np
from mpi4py import MPI

from task9_1 import manager_worker_AxB


def timed(comm, A, B, m):
    comm.Barrier()
    t0 = MPI.Wtime()
    C = manager_worker_AxB(A, B, m, comm)
    return MPI.Wtime() - t0, C


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--N", type=int, default=1920)
    parser.add_argument("--m", type=int, nargs="+", default=[1, 2, 4, 8, 16, 32, 64])
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--csv", default="results_9_1.csv")
    args = parser.parse_args()

    comm = MPI.COMM_WORLD
    rank, P = comm.Get_rank(), comm.Get_size()
    A = B = None
    reference = None
    if rank == 0:
        rng = np.random.default_rng(1)
        A, B = rng.random((args.N, args.N)), rng.random((args.N, args.N))
        t0 = MPI.Wtime()
        reference = A @ B
        print(f"N={args.N} P={P} sequential A @ B {MPI.Wtime() - t0:.3f} s", flush=True)

    rows = []
    for m in args.m:
        _, C = timed(comm, A, B, m)
        if rank == 0:
            np.testing.assert_allclose(C, reference, rtol=1e-10)
        times = []
        for r in range(args.runs):
            t, _ = timed(comm, A, B, m)
            times.append(t)
            rows.append((P, args.N, m, r, t))
        if rank == 0:
            n = args.N // m
            mbytes = 24 * n * n * m ** 3 / 1e6
            print(f"m={m:3d} n={n:5d} tasks={m ** 3:7d} messages={6 * m ** 3 + 2 * (P - 1):8d} payload={mbytes:9.1f} MB "
                  f"median {np.median(times):8.3f} s (min {min(times):.3f}, max {max(times):.3f})", flush=True)

    if rank == 0:
        new = not os.path.exists(args.csv)
        with open(args.csv, "a", newline="") as f:
            w = csv.writer(f)
            if new:
                w.writerow(["P", "N", "m", "run", "seconds"])
            w.writerows(rows)


main()
