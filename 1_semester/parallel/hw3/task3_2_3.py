import numpy
from mpi4py import MPI

def return_every_3rd_number(source, dest, tag, data):
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()

    if rank == source:
        # 1. Отправляем метаданные (размер и тип), чтобы dest знал, сколько памяти выделить
        comm.send((data.size, data.dtype), dest=dest, tag=tag)
        # 2. Отправляем сам массив (быстрый C-level Send)
        comm.Send(data, dest=dest, tag=tag)

        # 3. Принимаем метаданные возвращаемого массива
        ret_size, ret_dtype = comm.recv(source=dest, tag=tag+1)
        returned_arr = numpy.empty(ret_size, dtype=ret_dtype)
        # 4. Принимаем сам возвращенный массив
        comm.Recv(returned_arr, source=dest, tag=tag+1)

        return returned_arr

    elif rank == dest:
        # 1. Принимаем метаданные и выделяем пустой буфер
        size, dtype = comm.recv(source=source, tag=tag)
        received_items = numpy.empty(size, dtype=dtype)

        # 2. Принимаем исходный массив
        comm.Recv(received_items, source=source, tag=tag)

        send_back = received_items[::3].copy()

        comm.send((send_back.size, send_back.dtype), dest=source, tag=tag+1)
        comm.Send(send_back, dest=source, tag=tag+1)

        return received_items

    else:
        return None

comm = MPI.COMM_WORLD
rank_m = comm.Get_rank()
size_m = comm.Get_size()

if size_m <= 1:
    print('Start at least 2 engines!')
else:
    source=0
    dest=1

    numpy.random.seed(42)
    arr = numpy.random.random(5)

    returned_arr = return_every_3rd_number(source=source, dest=dest, tag=333, data=arr)

    if rank_m == source:
        numpy.testing.assert_equal(arr[3], returned_arr[1])
        print(f"[Rank {rank_m}] Verification passed! arr[3] == returned_arr[1] == {arr[3]:.4f}")
    elif rank_m == dest:
        numpy.testing.assert_equal(len(arr), 5)
        print(f"[Rank {rank_m}] Dest successfully received full array of length {len(returned_arr)}")
    else:
        numpy.testing.assert_equal(returned_arr, None)
        print(f"[Rank {rank_m}] Other process correctly returned: {returned_arr}")
