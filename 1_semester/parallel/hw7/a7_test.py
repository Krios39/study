import sys

import numpy as np
from mpi4py import MPI

from task7_1 import ring_matrix_multiplication
from task7_2 import ring_matrix_multiplication_nb
from task7_bonus_a import ring_matrix_multiplication_circulate_A
from task7_bonus_b import ring_matrix_multiplication_rect

SQUARE_METHODS = {
    "blocking (7.1)": ring_matrix_multiplication,
    "nonblocking (7.2)": ring_matrix_multiplication_nb,
    "circulate A (bonus A)": ring_matrix_multiplication_circulate_A,
    "rectangular (bonus B)": ring_matrix_multiplication_rect,
}
RTOL = 1.0e-10
ATOL = 1.0e-12


def square_problems(P, rng):
    known_A = np.arange(1, 4 * P * 4 * P + 1, dtype=np.float64).reshape(4 * P, 4 * P)
    problems = [
        ("N=P random", rng.random((P, P)), rng.random((P, P))),
        ("identity x random", np.eye(2 * P), rng.random((2 * P, 2 * P))),
        ("random x identity", rng.random((2 * P, 2 * P)), np.eye(2 * P)),
        ("zero x random", np.zeros((3 * P, 3 * P)), rng.random((3 * P, 3 * P))),
        ("known integers", known_A, known_A.T.copy()),
        ("course test n=3", rng.random((3 * P, 3 * P)), rng.random((3 * P, 3 * P))),
        ("dense N=64*P", rng.standard_normal((64 * P, 64 * P)), rng.standard_normal((64 * P, 64 * P))),
    ]
    if P == 1:
        problems.append(("2x2 by hand", np.array([[1.0, 2.0], [3.0, 4.0]]), np.array([[5.0, 6.0], [7.0, 8.0]])))
    return problems


def rect_problems(P, rng):
    return [
        ("N=2P, K=3, M=3P", rng.random((2 * P, 3)), rng.random((3, 3 * P))),
        ("N=P, K=7, M=2P", rng.random((P, 7)), rng.random((7, 2 * P))),
        ("N=3P, K=1, M=P", rng.random((3 * P, 1)), rng.random((1, P))),
        ("N=5P, K=40, M=2P", rng.standard_normal((5 * P, 40)), rng.standard_normal((40, 2 * P))),
    ]


def local_blocks(A, B, rank, P):
    n = A.shape[0] // P
    m = B.shape[1] // P
    return A[rank * n:(rank + 1) * n, :].copy(), np.ascontiguousarray(B[:, rank * m:(rank + 1) * m])


def run(func, A, B, comm):
    rank, P = comm.Get_rank(), comm.Get_size()
    A_rowbl, B_colbl = local_blocks(A, B, rank, P)
    B_before = B_colbl.copy()
    comm.Barrier()
    C = func(A_rowbl, B_colbl)
    error = None
    if not np.array_equal(B_colbl, B_before):
        error = "input B_colbl was modified"
    if rank == 0 and error is None:
        try:
            if not isinstance(C, np.ndarray) or C.shape != (A.shape[0], B.shape[1]):
                raise AssertionError(f"rank 0 must return an array of shape {(A.shape[0], B.shape[1])}")
            np.testing.assert_allclose(C, A @ B, rtol=RTOL, atol=ATOL)
        except AssertionError as exc:
            error = str(exc).strip().splitlines()[0]
    errors = comm.gather(error, root=0)
    msg = next((e for e in errors if e), None) if rank == 0 else None
    return comm.bcast(msg, root=0), C


def main():
    comm = MPI.COMM_WORLD
    rank, P = comm.Get_rank(), comm.Get_size()
    rng = np.random.default_rng(20261018)
    if rank == 0:
        print(f"P = {P}", flush=True)

    passed = failed = 0

    def report(name, label, msg):
        nonlocal passed, failed
        if msg is None:
            passed += 1
        else:
            failed += 1
        if rank == 0:
            line = f"[{'PASS' if msg is None else 'FAIL'}] {name:24s} {label}"
            print(line if msg is None else f"{line}: {msg}", flush=True)

    for label, A, B in square_problems(P, rng):
        results = {}
        for name, func in SQUARE_METHODS.items():
            msg, C = run(func, A, B, comm)
            report(name, label, msg)
            results[name] = C
        if rank == 0:
            same = np.array_equal(results["blocking (7.1)"], results["nonblocking (7.2)"])
            diff = np.max(np.abs(results["blocking (7.1)"] - results["nonblocking (7.2)"]))
            print(f"       7.2a blocking vs nonblocking: {'bitwise identical' if same else f'max |diff| = {diff:.2e}'}",
                  flush=True)

    for label, A, B in rect_problems(P, rng):
        msg, _ = run(ring_matrix_multiplication_rect, A, B, comm)
        report("rectangular (bonus B)", label, msg)

    if rank == 0:
        print(f"\npassed {passed}, failed {failed}", flush=True)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
