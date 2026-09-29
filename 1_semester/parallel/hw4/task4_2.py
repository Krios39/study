import numpy as np
from mpi4py import MPI

def Ax_rowblock(A, x, K):
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    # 1. Определяем N на нулевом ранге и рассылаем всем процессам
    N_arr = np.empty(1, dtype=np.intc)
    if rank == 0:
        if A.shape[0] != A.shape[1] or A.shape[0] != len(x):
            raise ValueError("Matrix A must be NxN and vector x must be of length N.")
        N_arr[0] = A.shape[0]

    comm.Bcast(N_arr, root=0)
    N = int(N_arr[0])

    # 2. Проверяем предусловия P <= N и N % P == 0
    if size > N or N % size != 0:
        raise ValueError(f"Preconditions violated: P ({size}) must be <= N ({N}) and N % P == 0.")

    local_N = N // size

    # 3. Рассылаем исходный вектор x на все ранги
    x_full = np.empty(N, dtype=np.float64)
    if rank == 0:
        x_full[:] = x  # копируем данные, чтобы не менять оригинальный массив

    comm.Bcast(x_full, root=0)

    # 4. Распределяем матрицу A блоками строк (Scatter)
    # Каждый ранг выделяет память ТОЛЬКО под свой блок, как требует задание
    local_A = np.empty((local_N, N), dtype=np.float64)

    if rank == 0:
        # Убеждаемся, что матрица непрерывна в памяти (contiguous)
        A_contig = np.ascontiguousarray(A, dtype=np.float64)
    else:
        A_contig = None

    comm.Scatter(A_contig, local_A, root=0)

    # 5. Выполняем K итераций умножения y = A*x
    local_y = np.empty(local_N, dtype=np.float64)

    for _ in range(K):
        # Локальное умножение блока строк матрицы на полный вектор x
        np.dot(local_A, x_full, out=local_y)

        # Собираем локальные результаты local_y в новый полный вектор x_full
        comm.Allgather(local_y, x_full)

    # 6. Возвращаем результат
    if rank == 0:
        return x_full
    else:
        return None

if __name__ == "__main__":
    # Блок защищен, чтобы import функции не запускал случайный код
    pass
