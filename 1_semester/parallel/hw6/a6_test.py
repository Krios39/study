import argparse
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


K_VALUES = (0, 1, 2, 5, 10)
SEED = 20261013
RTOL = 1.0e-10
ATOL = 1.0e-12


def make_matrices(n, rng):
    dense = rng.random((n, n)) / n * 2
    return {
        "identity": np.eye(n),
        "zero": np.zeros((n, n)),
        "diagonal": np.diag(rng.uniform(0.5, 1.5, n)),
        "dense": dense,
    }


def serial_reference(A, x, K):
    y = x.copy()
    for _ in range(K):
        y = A @ y
    return y


def run_case(func, A, x, K, comm):
    rank = comm.Get_rank()
    comm.Barrier()
    try:
        y = func(A if rank == 0 else None, x if rank == 0 else None, K)
        error = None
    except Exception as exc:
        y, error = None, f"{type(exc).__name__}: {exc}"

    if rank == 0 and error is None:
        try:
            if not isinstance(y, np.ndarray) or y.shape != x.shape:
                raise AssertionError(f"rank 0 must return an array of shape {x.shape}, got {type(y).__name__}")
            np.testing.assert_allclose(y, serial_reference(A, x, K), rtol=RTOL, atol=ATOL)
        except AssertionError as exc:
            error = str(exc).strip().splitlines()[0]
    errors = comm.gather(error, root=0)
    msg = None
    if rank == 0:
        msg = next((e for e in errors if e is not None), None)
    msg = comm.bcast(msg, root=0)
    return msg is None, msg


def applicable(name, n, size):
    if name == "cell":
        p = int(round(np.sqrt(size)))
        return p * p == size and n % p == 0
    return n % size == 0


def main():
    parser = argparse.ArgumentParser(description="Correctness tests for Assignment 6.")
    parser.add_argument("--methods", default="row,col,rsb,cell",
                        help="comma-separated subset of: " + ",".join(METHODS))
    args = parser.parse_args()

    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()
    rng = np.random.default_rng(SEED)

    problems = []
    if rank == 0:
        example = np.arange(1, 17, dtype=np.float64).reshape(4, 4)
        problems.append(("example 4x4", example, np.ones(4)))
        for n in (8, 64):
            x = rng.standard_normal(n)
            for name, A in make_matrices(n, rng).items():
                problems.append((f"{name} {n}x{n}", A, x))
    names = comm.bcast([(p[0], p[1].shape[0]) for p in problems] if rank == 0 else None, root=0)

    if rank == 0:
        print(f"P = {size}", flush=True)

    passed = failed = skipped = 0
    for method in args.methods.split(","):
        func = METHODS[method]
        for idx, (label, n) in enumerate(names):
            if not applicable(method, n, size):
                skipped += len(K_VALUES)
                continue
            A, x = (problems[idx][1], problems[idx][2]) if rank == 0 else (None, None)
            for K in K_VALUES:
                ok, msg = run_case(func, A, x, K, comm)
                if ok:
                    passed += 1
                else:
                    failed += 1
                if rank == 0:
                    status = "PASS" if ok else "FAIL"
                    line = f"[{status}] {func.__name__:20s} {label:16s} K={K}"
                    print(line if ok else f"{line}: {msg}", flush=True)

    if rank == 0:
        print(f"\npassed {passed}, failed {failed}, skipped {skipped} (method not applicable for P={size})", flush=True)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
