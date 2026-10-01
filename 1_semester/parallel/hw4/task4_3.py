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

    if N % size != 0:
        if rank == 0:
            print(f"Error: N={N} must be divisible by P={size}")
        sys.exit(1)

    local_N = N // size

    if rank == 0:
        np.random.seed(2026)
        A = np.random.rand(N, N).astype(np.float64)
        x_init = np.random.rand(N).astype(np.float64)
        A_contig = np.ascontiguousarray(A)
    else:
        A = None
        x_init = None
        A_contig = None

    local_A = np.empty((local_N, N), dtype=np.float64)
    x_full = np.empty(N, dtype=np.float64)
    local_y = np.empty(local_N, dtype=np.float64)

    if rank == 0:
        x_full[:] = x_init[:]

    comm.Bcast(x_full, root=0)
    comm.Scatter(A_contig, local_A, root=0)

    for _ in range(2):
        np.dot(local_A, x_full, out=local_y)
        comm.Allgather(local_y, x_full)

    if rank == 0:
        x_serial = x_init.copy()
        for _ in range(2):
            x_serial = np.dot(A, x_serial)
        try:
            np.testing.assert_allclose(x_full, x_serial, rtol=1e-9, atol=1e-9)
            print(f"[P={size}] Correctness check passed!")
        except AssertionError:
            print(f"[P={size}] Correctness check FAILED!")
            sys.exit(1)

    runs = 6
    e2e_times = []
    kernel_times = []

    for i in range(runs):
        if rank == 0:
            x_full[:] = x_init[:]

        comm.Barrier()
        t_start_e2e = MPI.Wtime()

        comm.Bcast(x_full, root=0)
        comm.Scatter(A_contig, local_A, root=0)

        comm.Barrier()
        t_start_kernel = MPI.Wtime()

        for _ in range(K):
            np.dot(local_A, x_full, out=local_y)
            comm.Allgather(local_y, x_full)

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
        print(f"--- Results for P = {size} ---")
        print(f"Median End-to-End Time : {med_e2e:.4f} sec")
        print(f"Median Kernel Time     : {med_kernel:.4f} sec")
        print("-" * 30)

main()
