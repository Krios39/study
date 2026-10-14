import numpy as np
from mpi4py import MPI

from task6_1 import _broadcast_n, _check_divisible, _k_zero, _mark, _store


def Ax_cellblock(A, x, K, timing=None):
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    p = int(round(np.sqrt(size)))
    if p * p != size:
        raise ValueError(f"Cell-block distribution needs a square number of processes, got P={size}.")

    t0 = _mark(comm, timing)
    N = _broadcast_n(comm, A, x)
    _check_divisible(N, p, "p")
    if K == 0:
        return _k_zero(comm, x)

    n = N // p
    grid = comm.Create_cart([p, p], periods=[False, False], reorder=False)
    i, j = grid.Get_coords(rank)
    row_comm = grid.Sub([False, True])
    col_comm = grid.Sub([True, False])

    if rank == 0:
        A_blocks = np.empty((size, n, n), dtype=np.float64)
        x_blocks = np.empty((size, n), dtype=np.float64)
        for r in range(size):
            bi, bj = grid.Get_coords(r)
            A_blocks[r] = A[bi * n:(bi + 1) * n, bj * n:(bj + 1) * n]
            x_blocks[r] = x[bj * n:(bj + 1) * n]
    else:
        A_blocks = x_blocks = None
    local_A = np.empty((n, n), dtype=np.float64)
    x_local = np.empty(n, dtype=np.float64)
    comm.Scatter(A_blocks, local_A, root=0)
    comm.Scatter(x_blocks, x_local, root=0)

    z = np.empty(n, dtype=np.float64)
    y_i = np.empty(n, dtype=np.float64)
    t1 = _mark(comm, timing)

    for k in range(K):
        np.dot(local_A, x_local, out=z)
        if k < K - 1:
            row_comm.Reduce(z, y_i, op=MPI.SUM, root=i)
            if i == j:
                x_local[:] = y_i
            col_comm.Bcast(x_local, root=j)
        else:
            row_comm.Reduce(z, y_i, op=MPI.SUM, root=0)

    y = np.empty(N, dtype=np.float64) if rank == 0 else None
    if j == 0:
        col_comm.Gather(y_i, y, root=0)

    t2 = _mark(comm, timing)
    row_comm.Free()
    col_comm.Free()
    grid.Free()
    _store(timing, t0, t1, t2)
    return y


if __name__ == "__main__":
    pass
