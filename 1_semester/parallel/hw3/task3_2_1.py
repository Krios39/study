import numpy
from mpi4py import MPI

def return_3rd(source, dest, tag, items):
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()

    if rank == source:
        comm.send(items, dest=dest, tag=tag)
        third_item = comm.recv(source=dest, tag=tag+1)
        return third_item

    elif rank == dest:
        received_items = comm.recv(source=source, tag=tag)
        comm.send(received_items[2], dest=source, tag=tag+1)
        return received_items

    else:
        return None

comm = MPI.COMM_WORLD
rank_m = comm.Get_rank()
size_m = comm.Get_size()
if size_m <= 1:
    print('Start at least 2 engines!')
else:
    source = 0
    dest = 1
    items = [0.1, 'Yes', 'Kolmas', 0.001]

    data = return_3rd(source, dest, 111, items)

    if rank_m == source:
        numpy.testing.assert_equal(data, 'Kolmas')
        print(f"[Rank {rank_m}] Source received correct 3rd item: {data}")
    elif rank_m == dest:
        numpy.testing.assert_equal(data, items)
        print(f"[Rank {rank_m}] Dest received full list: {data}")
    else:
        numpy.testing.assert_equal(data, None)
        print(f"[Rank {rank_m}] Other process returned: {data}")
