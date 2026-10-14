import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

import argparse
import csv
import sys

import numpy as np
from mpi4py import MPI


def allreduce(comm, send, recv):
    comm.Allreduce(send, recv, op=MPI.SUM)


def reduce_bcast(comm, send, recv):
    comm.Reduce(send, recv, op=MPI.SUM, root=0)
    comm.Bcast(recv, root=0)


METHODS = {"Allreduce": allreduce, "Reduce+Bcast": reduce_bcast}


def main():
    parser = argparse.ArgumentParser(description="Bonus 6: Allreduce vs Reduce + Bcast.")
    parser.add_argument("--sizes", type=int, nargs="+", default=[1, 100, 10_000, 1_000_000])
    parser.add_argument("--batches", type=int, default=7, help="timed batches per size (median is reported)")
    parser.add_argument("--csv", default="bonus_allreduce.csv")
    args = parser.parse_args()

    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()
    rows = []

    for n in args.sizes:
        send = np.arange(n, dtype=np.float64) * (rank + 1)
        expected = np.arange(n, dtype=np.float64) * (size * (size + 1) / 2)
        reps = int(min(1000, max(5, 2_000_000 // max(n, 1))))

        for name, op in METHODS.items():
            recv = np.empty(n, dtype=np.float64)

            op(comm, send, recv)
            ok = np.allclose(recv, expected)
            all_ok = comm.allreduce(ok, op=MPI.LAND)
            if rank == 0 and not all_ok:
                print(f"[FAIL] {name} n={n}: ranks disagree", flush=True)

            for _ in range(3):
                op(comm, send, recv)

            per_call = []
            for b in range(args.batches):
                comm.Barrier()
                t0 = MPI.Wtime()
                for _ in range(reps):
                    op(comm, send, recv)
                local = (MPI.Wtime() - t0) / reps
                t = comm.reduce(local, op=MPI.MAX, root=0)
                if rank == 0:
                    per_call.append(t)
                    rows.append([name, size, n, reps, b, t])

            if rank == 0:
                print(f"{name:13s} P={size:3d} n={n:8d}  median {np.median(per_call) * 1e6:10.2f} us/call  "
                      f"(min {min(per_call) * 1e6:.2f}, max {max(per_call) * 1e6:.2f}, {reps} calls x {args.batches})  "
                      f"{'OK' if all_ok else 'MISMATCH'}", flush=True)

    if rank == 0:
        new_file = not os.path.exists(args.csv)
        with open(args.csv, "a", newline="") as f:
            w = csv.writer(f)
            if new_file:
                w.writerow(["method", "P", "n", "reps", "batch", "seconds_per_call"])
            w.writerows(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
