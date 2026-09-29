
import argparse
import importlib
import importlib.util
from pathlib import Path
import sys

import numpy as np
from mpi4py import MPI


N = 64
K_VALUES = (0, 1, 5, 10)
BASE_SEED = 20260925
RTOL = 1.0e-10
ATOL = 1.0e-12


def load_ax_rowblock(solution: str):
    """Load ``Ax_rowblock`` from a Python file or importable module."""

    path = Path(solution)
    if path.suffix == ".py" or path.exists():
        if not path.is_file():
            raise FileNotFoundError(f"Solution file not found: {path}")

        resolved = path.resolve()
        spec = importlib.util.spec_from_file_location("a4_student_solution", resolved)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load solution file: {resolved}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    else:
        module = importlib.import_module(solution)

    try:
        function = module.Ax_rowblock
    except AttributeError as exc:
        raise AttributeError(
            f"{solution!r} does not define Ax_rowblock(A, x, K)"
        ) from exc

    if not callable(function):
        raise TypeError(f"{solution!r}.Ax_rowblock exists but is not callable")

    return function


def make_problem(n: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """Create deterministic, numerically stable float64 test data on rank 0."""

    rng = np.random.default_rng(seed)
    matrix = rng.random((n, n), dtype=np.float64)
    matrix /= matrix.sum(axis=1, keepdims=True)
    vector = rng.standard_normal(n).astype(np.float64, copy=False)
    return np.ascontiguousarray(matrix), np.ascontiguousarray(vector)


def serial_reference(matrix: np.ndarray, vector: np.ndarray, k: int) -> np.ndarray:
    """Calculate A**k @ x without explicitly forming the matrix power."""

    result = vector.copy()
    for _ in range(k):
        result = matrix @ result
    return result


def assert_valid_result(
    result,
    expected: np.ndarray,
    *,
    n: int,
    rtol: float,
    atol: float,
) -> None:
    """Validate the rank-0 return value and its numerical accuracy."""

    if not isinstance(result, np.ndarray):
        raise AssertionError(
            f"rank 0 must return a NumPy array, got {type(result).__name__}"
        )
    if result.shape != (n,):
        raise AssertionError(f"expected result shape {(n,)}, got {result.shape}")
    if not np.issubdtype(result.dtype, np.number):
        raise AssertionError(f"expected a numeric result dtype, got {result.dtype}")
    if not np.all(np.isfinite(result)):
        raise AssertionError("result contains NaN or infinite values")

    np.testing.assert_allclose(result, expected, rtol=rtol, atol=atol)


def run_case(ax_rowblock, *, n: int, k: int, seed: int, comm) -> bool:
    """Run one collective test and return the same pass/fail flag on all ranks."""

    rank = comm.Get_rank()

    if rank == 0:
        matrix, vector = make_problem(n, seed)
        matrix_reference = matrix.copy()
        vector_reference = vector.copy()
    else:
        # Non-root ranks must not allocate an N x N placeholder matrix.
        matrix = None
        vector = None
        matrix_reference = None
        vector_reference = None

    comm.Barrier()
    result = ax_rowblock(matrix, vector, k)

    if rank == 0:
        expected = serial_reference(matrix_reference, vector_reference, k)
        try:
            assert_valid_result(
                result,
                expected,
                n=n,
                rtol=RTOL,
                atol=ATOL,
            )
        except AssertionError as exc:
            passed = False
            print(f"[FAIL] N={n}, K={k}: {exc}", flush=True)
        else:
            passed = True
            print(f"[PASS] N={n}, K={k}", flush=True)
    else:
        passed = None

    return bool(comm.bcast(passed, root=0))


def parse_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Test an MPI Ax_rowblock(A, x, K) implementation."
    )
    parser.add_argument(
        "solution",
        nargs="?",
        default="a4_solution.py",
        help="solution Python file or importable module (default: a4_solution.py)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_arguments(argv)
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    if size > N or N % size != 0:
        if rank == 0:
            print(
                f"ERROR: this test uses N={N}, so the number of ranks must "
                f"satisfy P <= {N} and {N} % P == 0; received P={size}.",
                file=sys.stderr,
                flush=True,
            )
        return 2

    try:
        ax_rowblock = load_ax_rowblock(args.solution)
    except (AttributeError, FileNotFoundError, ImportError, TypeError) as exc:
        if rank == 0:
            print(f"ERROR: {exc}", file=sys.stderr, flush=True)
        return 2

    if rank == 0:
        print(
            f"Testing {args.solution}: Ax_rowblock with P={size} rank(s), N={N}",
            flush=True,
        )

    all_passed = True
    for case_number, k in enumerate(K_VALUES):
        passed = run_case(
            ax_rowblock,
            n=N,
            k=k,
            seed=BASE_SEED + case_number,
            comm=comm,
        )
        all_passed = all_passed and passed

    comm.Barrier()
    if rank == 0:
        if all_passed:
            print(
                "All correctness tests passed for this process count.",
                flush=True,
            )
        else:
            print(
                "One or more correctness tests failed.",
                file=sys.stderr,
                flush=True,
            )

    return 0 if all_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
