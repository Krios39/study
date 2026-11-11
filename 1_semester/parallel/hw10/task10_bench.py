import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import argparse
import csv
import sys

import numpy as np
from mpi4py import MPI

from task7_2 import ring_matrix_multiplication_nb


def local_blocks(rank, n, N):
    A_rowbl = np.random.default_rng([2026, rank]).random((n, N))
    B_colbl = np.random.default_rng([2027, rank]).random((N, n))
    return A_rowbl, B_colbl


def check(comm, A_rowbl, B_colbl, C, N):
    rank, n = comm.Get_rank(), A_rowbl.shape[0]
    x = np.random.default_rng(7).random(N)
    Bx = np.zeros(N)
    comm.Allreduce(B_colbl @ x[rank * n:(rank + 1) * n], Bx, op=MPI.SUM)
    ABx = np.empty(N) if rank == 0 else None
    comm.Gather(A_rowbl @ Bx, ABx, root=0)
    ok = None
    if rank == 0:
        ok = bool(np.linalg.norm(C @ x - ABx) <= 1e-10 * np.linalg.norm(ABx))
    return comm.bcast(ok, root=0)


def timed(comm, A_rowbl, B_colbl):
    comm.Barrier()
    t0 = MPI.Wtime()
    C = ring_matrix_multiplication_nb(A_rowbl, B_colbl, comm)
    t = comm.reduce(MPI.Wtime() - t0, op=MPI.MAX, root=0)
    return t, C


def main():
    parser = argparse.ArgumentParser(description="Assignment 10: ring matrix multiplication timings on rocket.")
    parser.add_argument("--strong", type=int, nargs="*", default=[7200], help="fixed N values for E10.1/E10.2")
    parser.add_argument("--weak", type=int, nargs="*", default=[256], help="block sizes n with N = n * P for E10.3")
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--label", default="")
    parser.add_argument("--csv", default=f"results_{os.environ.get('SLURM_JOB_ID', 'local')}.csv")
    args = parser.parse_args()

    comm = MPI.COMM_WORLD
    rank, P = comm.Get_rank(), comm.Get_size()
    hosts = sorted(set(comm.allgather(MPI.Get_processor_name())))
    nodes = len(hosts)
    label = args.label or f"{nodes}x{P // nodes}"
    if rank == 0:
        print(f"P={P} on {nodes} node(s): {','.join(hosts)}  label={label}", flush=True)

    cases = [("strong", N // P, N) for N in args.strong if N % P == 0]
    cases += [("weak", n, n * P) for n in args.weak]
    rows = []
    for kind, n, N in cases:
        A_rowbl, B_colbl = local_blocks(rank, n, N)
        _, C = timed(comm, A_rowbl, B_colbl)
        if not check(comm, A_rowbl, B_colbl, C, N):
            if rank == 0:
                print(f"[FAIL] {kind} N={N} P={P}", flush=True)
            comm.Abort(1)
        del C
        times = []
        for run in range(args.runs):
            t, C = timed(comm, A_rowbl, B_colbl)
            del C
            if rank == 0:
                times.append(t)
                rows.append([kind, label, nodes, P, N, n, run, t])
        if rank == 0:
            med = float(np.median(times))
            print(f"{kind:6s} P={P:3d} N={N:5d} n={n:5d}  median {med:.4f}s  (min {min(times):.4f} / max {max(times):.4f})  "
                  f"{2 * N ** 3 / med / 1e9:7.2f} GFLOP/s  check OK", flush=True)

    if rank == 0:
        new_file = not os.path.exists(args.csv)
        with open(args.csv, "a", newline="") as f:
            w = csv.writer(f)
            if new_file:
                w.writerow(["kind", "label", "nodes", "P", "N", "n", "run", "time"])
            w.writerows(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
