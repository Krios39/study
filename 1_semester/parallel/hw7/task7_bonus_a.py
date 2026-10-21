import numpy as np
from mpi4py import MPI

from task7_1 import _prepare


def ring_matrix_multiplication_circulate_A(A_rowbl, B_colbl, comm=MPI.COMM_WORLD):
    rank = comm.Get_rank()
    size = comm.Get_size()
    A_current, B, n, N = _prepare(comm, A_rowbl, B_colbl)
    A_current = A_current.copy()
    A_next = np.empty_like(A_current)
    C_colbl = np.empty((N, n), dtype=np.float64)
    right = (rank + 1) % size
    left = (rank - 1) % size

    for step in range(size):
        owner = (rank - step) % size
        C_colbl[owner * n:(owner + 1) * n, :] = A_current @ B
        if step < size - 1:
            comm.Sendrecv(A_current, dest=right, sendtag=step,
                          recvbuf=A_next, source=left, recvtag=step)
            A_current, A_next = A_next, A_current

    blocks = np.empty((size, N, n), dtype=np.float64) if rank == 0 else None
    comm.Gather(C_colbl, blocks, root=0)
    if rank != 0:
        return None
    return np.ascontiguousarray(blocks.transpose(1, 0, 2).reshape(N, N))
