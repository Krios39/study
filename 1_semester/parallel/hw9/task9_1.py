import numpy as np
from mpi4py import MPI

REQUEST = 1
TASK = 2
RESULT = 3
STOP = 4


def _manager(comm, A, B, m):
    N = A.shape[0]
    if A.shape != (N, N) or B.shape != (N, N):
        raise ValueError(f"Expected square matrices of equal size; got A {A.shape}, B {B.shape}.")
    if m < 1 or N % m != 0:
        raise ValueError(f"N must be divisible by m; got N = {N}, m = {m}.")
    n = N // m
    meta = np.array([N, m], dtype=np.int64)
    comm.Bcast(meta, root=0)

    A = np.ascontiguousarray(A, dtype=np.float64)
    B = np.ascontiguousarray(B, dtype=np.float64)
    C = np.zeros((N, N), dtype=np.float64)
    tasks = ((i, k, j) for i in range(m) for k in range(m) for j in range(m))
    active = comm.Get_size() - 1
    status = MPI.Status()
    empty = np.empty(0, dtype=np.int64)
    indices = np.empty(3, dtype=np.int64)
    D = np.empty((n, n), dtype=np.float64)

    while active > 0:
        comm.Probe(source=MPI.ANY_SOURCE, tag=MPI.ANY_TAG, status=status)
        worker, tag = status.Get_source(), status.Get_tag()
        if tag == RESULT:
            comm.Recv(indices, source=worker, tag=RESULT)
            comm.Recv(D, source=worker, tag=RESULT)
            i, _, j = indices
            C[i * n:(i + 1) * n, j * n:(j + 1) * n] += D
            continue
        comm.Recv(empty, source=worker, tag=REQUEST)
        task = next(tasks, None)
        if task is None:
            comm.Send(empty, dest=worker, tag=STOP)
            active -= 1
            continue
        i, k, j = task
        comm.Send(np.array(task, dtype=np.int64), dest=worker, tag=TASK)
        comm.Send(np.ascontiguousarray(A[i * n:(i + 1) * n, k * n:(k + 1) * n]), dest=worker, tag=TASK)
        comm.Send(np.ascontiguousarray(B[k * n:(k + 1) * n, j * n:(j + 1) * n]), dest=worker, tag=TASK)
    return C


def _worker(comm):
    meta = np.empty(2, dtype=np.int64)
    comm.Bcast(meta, root=0)
    N, m = int(meta[0]), int(meta[1])
    n = N // m
    empty = np.empty(0, dtype=np.int64)
    indices = np.empty(3, dtype=np.int64)
    Aik = np.empty((n, n), dtype=np.float64)
    Bkj = np.empty((n, n), dtype=np.float64)
    status = MPI.Status()

    while True:
        comm.Send(empty, dest=0, tag=REQUEST)
        comm.Probe(source=0, tag=MPI.ANY_TAG, status=status)
        if status.Get_tag() == STOP:
            comm.Recv(empty, source=0, tag=STOP)
            return None
        comm.Recv(indices, source=0, tag=TASK)
        comm.Recv(Aik, source=0, tag=TASK)
        comm.Recv(Bkj, source=0, tag=TASK)
        D = Aik @ Bkj
        comm.Send(indices, dest=0, tag=RESULT)
        comm.Send(D, dest=0, tag=RESULT)


def manager_worker_AxB(A, B, m=5, comm=MPI.COMM_WORLD):
    if comm.Get_size() < 2:
        raise ValueError("manager_worker_AxB needs P >= 2 (one manager plus workers).")
    if comm.Get_rank() == 0:
        return _manager(comm, A, B, m)
    return _worker(comm)
