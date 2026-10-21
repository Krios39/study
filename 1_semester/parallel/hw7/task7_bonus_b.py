import numpy as np
from mpi4py import MPI


def ring_matrix_multiplication_rect(A_rowbl, B_colbl, comm=MPI.COMM_WORLD):
    rank = comm.Get_rank()
    size = comm.Get_size()
    A = np.ascontiguousarray(A_rowbl, dtype=np.float64)
    B_current = np.ascontiguousarray(B_colbl, dtype=np.float64)
    n_rows, K = A.shape
    if B_current.shape[0] != K:
        raise ValueError(f"Inner dimensions differ: A_rowbl {A.shape}, B_colbl {B_current.shape}.")
    m_cols = B_current.shape[1]
    N, M = n_rows * size, m_cols * size

    B_current = B_current.copy()
    B_next = np.empty_like(B_current)
    C_local = np.empty((n_rows, M), dtype=np.float64)
    right = (rank + 1) % size
    left = (rank - 1) % size

    for step in range(size):
        q = (rank - step) % size
        C_local[:, q * m_cols:(q + 1) * m_cols] = A @ B_current
        if step < size - 1:
            comm.Sendrecv(B_current, dest=right, sendtag=step,
                          recvbuf=B_next, source=left, recvtag=step)
            B_current, B_next = B_next, B_current

    C = np.empty((N, M), dtype=np.float64) if rank == 0 else None
    comm.Gather(C_local, C, root=0)
    return C
