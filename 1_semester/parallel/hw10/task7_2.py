import numpy as np
from mpi4py import MPI

from task7_1 import _prepare, _gather_rows


def ring_matrix_multiplication_nb(A_rowbl, B_colbl, comm=MPI.COMM_WORLD):
    rank = comm.Get_rank()
    size = comm.Get_size()
    A, B_colbl, n, N = _prepare(comm, A_rowbl, B_colbl)
    B_current = B_colbl.copy()
    B_next = np.empty_like(B_current)
    C_local = np.empty((n, N), dtype=np.float64)
    right = (rank + 1) % size
    left = (rank - 1) % size

    for step in range(size):
        q = (rank - step) % size
        last = step == size - 1
        if not last:
            requests = [comm.Irecv(B_next, source=left, tag=step),
                        comm.Isend(B_current, dest=right, tag=step)]
        C_local[:, q * n:(q + 1) * n] = A @ B_current
        if not last:
            MPI.Request.Waitall(requests)
            B_current, B_next = B_next, B_current

    return _gather_rows(comm, C_local, N)
