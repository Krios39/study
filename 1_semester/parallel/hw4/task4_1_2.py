import numpy as np
import sys
from mpi4py import MPI

comm = MPI.COMM_WORLD
rank = comm.Get_rank()
size = comm.Get_size()

if len(sys.argv) != 3:
    if rank == 0:
        print("Usage: mpiexec -n <P> python3 task4_2.py <N> <K>")
    sys.exit(1)

N = int(sys.argv[1])
K = int(sys.argv[2])

if N % size != 0:
    if rank == 0:
        print(f"Error: Matrix size N ({N}) must be divisible by number of processes ({size}).")
    sys.exit(1)

local_N = N // size

if rank == 0:
    np.random.seed(2026)
    A = np.random.rand(N, N)
    x_initial = np.random.rand(N)
    x_full = x_initial.copy()
else:
    A = None
    x_full = np.empty(N, dtype=np.float64)

comm.Bcast(x_full, root=0)

local_A = np.empty((local_N, N), dtype=np.float64)
comm.Scatter(A, local_A, root=0)

local_y = np.empty(local_N, dtype=np.float64)

for _ in range(K):

    local_y = np.dot(local_A, x_full)


    comm.Allgather(local_y, x_full)

if rank == 0:
    x_serial = x_initial.copy()

    for _ in range(K):
        x_serial = np.dot(A, x_serial)

    if np.allclose(x_full, x_serial):
        print(f"[Rank 0] Validation passed! Parallel result perfectly matches serial reference for N={N}, K={K}.")
    else:
        print("[Rank 0] Error: Validation failed! Results do not match.")
        sys.exit(1)
