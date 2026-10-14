import numpy as np
from mpi4py import MPI


def _broadcast_n(comm, A, x):
    rank = comm.Get_rank()
    N_arr = np.empty(1, dtype=np.intc)
    if rank == 0:
        if A.ndim != 2 or A.shape[0] != A.shape[1] or A.shape[0] != len(x):
            raise ValueError("Matrix A must be NxN and vector x must be of length N.")
        N_arr[0] = A.shape[0]
    comm.Bcast(N_arr, root=0)
    return int(N_arr[0])


def _check_divisible(N, parts, what):
    if parts > N or N % parts != 0:
        raise ValueError(f"Preconditions violated: {what} ({parts}) must be <= N ({N}) and N % {what} == 0.")


def _k_zero(comm, x):
    if comm.Get_rank() == 0:
        return np.array(x, dtype=np.float64, copy=True)
    return None


def _mark(comm, timing):
    if timing is None:
        return 0.0
    comm.Barrier()
    return MPI.Wtime()


def _store(timing, t0, t1, t2):
    if timing is not None:
        timing["setup"] = t1 - t0
        timing["mult"] = t2 - t1
        timing["total"] = t2 - t0


def Ax_rowblock(A, x, K, timing=None):
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    t0 = _mark(comm, timing)
    N = _broadcast_n(comm, A, x)
    _check_divisible(N, size, "P")
    if K == 0:
        return _k_zero(comm, x)

    local_N = N // size

    x_full = np.empty(N, dtype=np.float64)
    if rank == 0:
        x_full[:] = x
    comm.Bcast(x_full, root=0)

    A_contig = np.ascontiguousarray(A, dtype=np.float64) if rank == 0 else None
    local_A = np.empty((local_N, N), dtype=np.float64)
    comm.Scatter(A_contig, local_A, root=0)

    local_y = np.empty(local_N, dtype=np.float64)
    t1 = _mark(comm, timing)

    for _ in range(K):
        np.dot(local_A, x_full, out=local_y)
        comm.Allgather(local_y, x_full)

    t2 = _mark(comm, timing)
    _store(timing, t0, t1, t2)
    return x_full if rank == 0 else None


def _distribute_columns(comm, A, x, N):
    rank = comm.Get_rank()
    local_N = N // comm.Get_size()

    AT = np.ascontiguousarray(A.T, dtype=np.float64) if rank == 0 else None
    local_AT = np.empty((local_N, N), dtype=np.float64)
    comm.Scatter(AT, local_AT, root=0)

    x_send = np.ascontiguousarray(x, dtype=np.float64) if rank == 0 else None
    x_local = np.empty(local_N, dtype=np.float64)
    comm.Scatter(x_send, x_local, root=0)
    return local_AT, x_local


def Ax_columnblock(A, x, K, timing=None):
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    t0 = _mark(comm, timing)
    N = _broadcast_n(comm, A, x)
    _check_divisible(N, size, "P")
    if K == 0:
        return _k_zero(comm, x)

    local_N = N // size
    lo, hi = rank * local_N, (rank + 1) * local_N
    local_AT, x_local = _distribute_columns(comm, A, x, N)

    z = np.empty(N, dtype=np.float64)
    y = np.empty(N, dtype=np.float64)
    t1 = _mark(comm, timing)

    for k in range(K):
        np.dot(local_AT.T, x_local, out=z)
        if k < K - 1:
            comm.Allreduce(z, y, op=MPI.SUM)
            x_local[:] = y[lo:hi]
        else:
            comm.Reduce(z, y, op=MPI.SUM, root=0)

    t2 = _mark(comm, timing)
    _store(timing, t0, t1, t2)
    return y if rank == 0 else None
