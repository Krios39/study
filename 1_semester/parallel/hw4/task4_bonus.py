import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import numpy as np
from mpi4py import MPI
import sys

def main():
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    N = 4096
    K = 50

    counts = np.array([N // size + (1 if i < N % size else 0) for i in range(size)], dtype=np.intc)
    displs = np.insert(np.cumsum(counts), 0, 0)[:-1]
    local_N = counts[rank]

    if rank == 0:
        np.random.seed(2026)
        A = np.random.rand(N, N).astype(np.float64)
        x_init = np.random.rand(N).astype(np.float64)
        A_packed = np.empty((N, N), dtype=np.float64)
    else:
        A = None
        x_init = None
        A_packed = None

    local_A = np.empty((local_N, N), dtype=np.float64)
    x_full = np.empty(N, dtype=np.float64)
    local_y = np.empty(local_N, dtype=np.float64)
    gathered_y = np.empty(N, dtype=np.float64)

    sendcounts_A = counts * N
    displs_A = displs * N

    runs = 6
    e2e_times = []
    kernel_times = []

    for i in range(runs):
        if rank == 0:
            x_full[:] = x_init[:]

        comm.Barrier()
        t_start_e2e = MPI.Wtime()

        if rank == 0:
            for j in range(size):
                A_packed[displs[j]:displs[j]+counts[j], :] = A[j::size, :]

        comm.Scatterv([A_packed, sendcounts_A, displs_A, MPI.DOUBLE], local_A, root=0)
        comm.Bcast(x_full, root=0)

        comm.Barrier()
        t_start_kernel = MPI.Wtime()

        for _ in range(K):
            np.dot(local_A, x_full, out=local_y)
            comm.Allgatherv(local_y, [gathered_y, counts, displs, MPI.DOUBLE])

            for j in range(size):
                x_full[j::size] = gathered_y[displs[j]:displs[j]+counts[j]]

        comm.Barrier()
        t_end = MPI.Wtime()

        local_e2e = t_end - t_start_e2e
        local_kernel = t_end - t_start_kernel

        max_e2e = comm.reduce(local_e2e, op=MPI.MAX, root=0)
        max_kernel = comm.reduce(local_kernel, op=MPI.MAX, root=0)

        if rank == 0 and i > 0:
            e2e_times.append(max_e2e)
            kernel_times.append(max_kernel)

    if rank == 0:
        med_e2e = np.median(e2e_times)
        med_kernel = np.median(kernel_times)
        print(f"--- ROW-CYCLIC Benchmark (P = {size}) ---")
        print(f"Median End-to-End Time : {med_e2e:.4f} sec")
        print(f"Median Kernel Time     : {med_kernel:.4f} sec")
        print("-" * 35)

main()
