import numpy as np
from mpi4py import MPI


def _prepare(comm, A_rowbl, B_colbl):
    size = comm.Get_size()
    A = np.ascontiguousarray(A_rowbl, dtype=np.float64)
    B = np.ascontiguousarray(B_colbl, dtype=np.float64)
    n, N = A.shape
    if N != n * size or B.shape != (N, n):
        raise ValueError(f"Expected A_rowbl of shape (n, N) and B_colbl of shape (N, n) with N = n * P; "
                         f"got A_rowbl {A.shape}, B_colbl {B.shape}, P = {size}.")
    return A, B, n, N


def _gather_rows(comm, C_local, N):
    C = np.empty((N, N), dtype=np.float64) if comm.Get_rank() == 0 else None
    comm.Gather(C_local, C, root=0)
    return C


def ring_matrix_multiplication(A_rowbl, B_colbl, comm=MPI.COMM_WORLD):
    rank = comm.Get_rank()
    size = comm.Get_size()
    A, B_current, n, N = _prepare(comm, A_rowbl, B_colbl)
    B_current = B_current.copy()
    B_next = np.empty_like(B_current)
    C_local = np.empty((n, N), dtype=np.float64)
    right = (rank + 1) % size
    left = (rank - 1) % size

    for step in range(size):
        q = (rank - step) % size
        C_local[:, q * n:(q + 1) * n] = A @ B_current
        if step < size - 1:
            comm.Sendrecv(B_current, dest=right, sendtag=step,
                          recvbuf=B_next, source=left, recvtag=step)
            B_current, B_next = B_next, B_current

    return _gather_rows(comm, C_local, N)


ring_matrix_multiplier = ring_matrix_multiplication
