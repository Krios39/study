import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import argparse
import csv
import sys

import numpy as np
from mpi4py import MPI

from task6_1 import Ax_rowblock, Ax_columnblock
from task6_3 import Ax_cellblock
from task6_bonus_b import Ax_columnblock_rsb

METHODS = {
    "row": Ax_rowblock,
    "col": Ax_columnblock,
    "rsb": Ax_columnblock_rsb,
    "cell": Ax_cellblock,
}


def applicable(method, N, size):
    if method == "cell":
        p = int(round(np.sqrt(size)))
        return p * p == size and N % p == 0
    return N % size == 0


def time_one(func, A, x, K, comm):
    timing = {}
    func(A, x, K, timing=timing)
    local = np.array([timing["setup"], timing["mult"], timing["total"]])
    result = np.empty(3) if comm.Get_rank() == 0 else None
    comm.Reduce(local, result, op=MPI.MAX, root=0)
    return result


def main():
    parser = argparse.ArgumentParser(description="Timing of the Assignment 6 algorithms.")
    parser.add_argument("--N", type=int, nargs="+", default=[4096])
    parser.add_argument("--K", type=int, nargs="+", default=[50])
    parser.add_argument("--runs", type=int, default=5, help="measured runs per configuration (median is reported)")
    parser.add_argument("--methods", default="row,col", help="comma-separated subset of: " + ",".join(METHODS))
    parser.add_argument("--csv", default="results.csv", help="raw timings are appended here")
    parser.add_argument("--experiment", default="scaling", help="label stored in the CSV (scaling / size / amortisation)")
    args = parser.parse_args()

    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    rows = []
    for N in args.N:
        if rank == 0:
            rng = np.random.default_rng(2026)
            A = rng.random((N, N)) / N
            x = rng.random(N)
        else:
            A = x = None

        for K in args.K:
            for method in args.methods.split(","):
                if not applicable(method, N, size):
                    if rank == 0:
                        print(f"skip {method}: not applicable for N={N}, P={size}", flush=True)
                    continue
                func = METHODS[method]

                y = func(A, x, K)
                if rank == 0:
                    ref = x.copy()
                    for _ in range(K):
                        ref = A @ ref
                    try:
                        np.testing.assert_allclose(y, ref, rtol=1e-9, atol=1e-12)
                    except AssertionError as exc:
                        print(f"[FAIL] {method} N={N} K={K}: {exc}", flush=True)
                        comm.Abort(1)

                times = []
                for run in range(args.runs):
                    t = time_one(func, A, x, K, comm)
                    if rank == 0:
                        times.append(t)
                        rows.append([args.experiment, method, size, N, K, run, *t])

                if rank == 0:
                    t = np.array(times)
                    med = np.median(t, axis=0)
                    print(f"{method:5s} P={size:3d} N={N:5d} K={K:4d}  "
                          f"setup {med[0]:.4f}s  mult {med[1]:.4f}s  total {med[2]:.4f}s  "
                          f"(total min {t[:, 2].min():.4f} / max {t[:, 2].max():.4f}, {args.runs} runs)",
                          flush=True)

    if rank == 0:
        new_file = not os.path.exists(args.csv)
        with open(args.csv, "a", newline="") as f:
            w = csv.writer(f)
            if new_file:
                w.writerow(["experiment", "method", "P", "N", "K", "run", "setup", "mult", "total"])
            w.writerows(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
