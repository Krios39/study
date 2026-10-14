import numpy as np
from mpi4py import MPI

from task6_1 import _broadcast_n, _check_divisible, _k_zero, _mark, _store, _distribute_columns


def Ax_columnblock_rsb(A, x, K, timing=None):
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    t0 = _mark(comm, timing)
    N = _broadcast_n(comm, A, x)
    _check_divisible(N, size, "P")
    if K == 0:
        return _k_zero(comm, x)

    local_AT, x_local = _distribute_columns(comm, A, x, N)

    z = np.empty(N, dtype=np.float64)
    t1 = _mark(comm, timing)

    for _ in range(K):
        np.dot(local_AT.T, x_local, out=z)
        comm.Reduce_scatter_block(z, x_local, op=MPI.SUM)

    y = np.empty(N, dtype=np.float64) if rank == 0 else None
    comm.Gather(x_local, y, root=0)

    t2 = _mark(comm, timing)
    _store(timing, t0, t1, t2)
    return y


if __name__ == "__main__":
    pass
