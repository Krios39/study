import time
import numpy
from mpi4py import MPI

comm = MPI.COMM_WORLD
rank = comm.Get_rank()
size = comm.Get_size()

if size < 2:
    if rank == 0:
        print("Error: Run with at least 2 processes (-n 2)")
    exit()

# Конфигурации для тестирования
test_cases = [
    {"name": "Small 1D (10^2 elements)", "shape": (100,), "dtype": numpy.float64},
    {"name": "Medium 1D (10^5 elements)", "shape": (100000,), "dtype": numpy.float64},
    {"name": "Large 1D (10^7 elements)", "shape": (10000000,), "dtype": numpy.float64},
    {"name": "2D Matrix (1000x1000 float)", "shape": (1000, 1000), "dtype": numpy.float64},
    {"name": "Integer Datatype (10^6 elements)", "shape": (1000000,), "dtype": numpy.int32},
]

if rank == 0:
    print(f"{'Test Case':<35} | {'Pickle (comm.send) [s]':<22} | {'Raw Buffer (comm.Send) [s]':<24} | {'Speedup':<10}")
    print("-" * 100)

for case in test_cases:
    data = numpy.ones(case["shape"], dtype=case["dtype"])

    comm.Barrier()

    start_time = MPI.Wtime()
    if rank == 0:
        comm.send(data, dest=1, tag=101)
    elif rank == 1:
        _ = comm.recv(source=0, tag=101)
    time_pickle = MPI.Wtime() - start_time

    comm.Barrier()

    start_time = MPI.Wtime()
    if rank == 0:
        comm.Send(data, dest=1, tag=102)
    elif rank == 1:
        recv_buffer = numpy.empty(case["shape"], dtype=case["dtype"])
        comm.Recv(recv_buffer, source=0, tag=102)
    time_raw = MPI.Wtime() - start_time

    if rank == 0:
        speedup = time_pickle / time_raw if time_raw > 0 else 0
        print(f"{case['name']:<35} | {time_pickle:<22.6f} | {time_raw:<24.6f} | {speedup:<10.1f}x")
