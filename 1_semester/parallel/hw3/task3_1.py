import time
import copy
import numpy as np
import matplotlib.pyplot as plt

def solver_python(a, b):
    n = len(b)
    a = copy.deepcopy(a)
    b = list(b)

    for k in range(n):
        if a[k][k] == 0.0:
            exit(-1)
        for i in range(k+1, n):
            a[i][k] = a[i][k] / a[k][k]
        for j in range(k+1, n):
            for i in range(k+1, n):
                a[i][j] = a[i][j] - a[i][k] * a[k][j]

    y = [0.0] * n
    y[0] = b[0]
    for i in range(1, n):
        y[i] = b[i]
        for j in range(i):
            y[i] = y[i] - a[i][j] * y[j]

    x = [0.0] * n
    x[n-1] = y[n-1] / a[n-1][n-1]
    for i in range(n-2, -1, -1):
        x[i] = y[i]
        for j in range(i+1, n):
            x[i] = x[i] - a[i][j] * x[j]
        x[i] = x[i] / a[i][i]
    return x


def solver_numpy(a, b):
    n = len(b)
    a = a.copy()
    b = b.copy()

    for k in range(n):
        if a[k, k] == 0.0:
            exit(-1)
        a[k+1:, k] = a[k+1:, k] / a[k, k]
        a[k+1:, k+1:] = a[k+1:, k+1:] - np.outer(a[k+1:, k], a[k, k+1:])

    y = np.zeros(n)
    y[0] = b[0]
    for i in range(1, n):
        y[i] = b[i] - np.dot(a[i, :i], y[:i])

    x = np.zeros(n)
    x[n-1] = y[n-1] / a[n-1, n-1]
    for i in range(n-2, -1, -1):
        x[i] = (y[i] - np.dot(a[i, i+1:], x[i+1:])) / a[i, i]

    return x


def run_benchmark():
    np.random.seed(42)

    sizes = list(range(10, 501, 10))
    repeats = 3

    times_python = []
    times_numpy_vect = []
    times_numpy_lib = []

    for n in sizes:
        print(f"Calculate {n}x{n} matrix...")

        A = np.random.random((n, n)) + np.eye(n) * n
        b = np.random.random(n)

        A_list = A.tolist()
        b_list = b.tolist()

        if n == 10:
            x_py = solver_python(A_list, b_list)
            x_np_vect = solver_numpy(A, b)
            x_lib = np.linalg.solve(A, b)

            np.testing.assert_allclose(np.dot(A, x_np_vect), b, rtol=1e-5, atol=1e-8)
            np.testing.assert_allclose(x_np_vect, x_lib, rtol=1e-5, atol=1e-8)
            np.testing.assert_allclose(x_py, x_lib, rtol=1e-5, atol=1e-8)

        t_py_list = []
        for _ in range(repeats):
            start = time.perf_counter()
            solver_python(A_list, b_list)
            t_py_list.append(time.perf_counter() - start)
        times_python.append(np.median(t_py_list))

        t_np_list = []
        for _ in range(repeats):
            start = time.perf_counter()
            solver_numpy(A, b)
            t_np_list.append(time.perf_counter() - start)
        times_numpy_vect.append(np.median(t_np_list))

        t_lib_list = []
        for _ in range(repeats):
            start = time.perf_counter()
            np.linalg.solve(A, b)
            t_lib_list.append(time.perf_counter() - start)
        times_numpy_lib.append(np.median(t_lib_list))


    plt.figure(figsize=(10, 6))

    plt.plot(sizes, times_python, label='1. Python lists (Baseline)', marker='o', markersize=3)
    plt.plot(sizes, times_numpy_vect, label='2. NumPy Vectorized', marker='s', markersize=3)
    plt.plot(sizes, times_numpy_lib, label='3. np.linalg.solve()', marker='^', markersize=3)

    plt.title('Performance Comparison: LU Decomposition (Speedup Curves)')
    plt.xlabel('Matrix Size (n)')
    plt.ylabel('Execution Time (seconds) - Log Scale')
    plt.yscale('log')
    plt.grid(True, which="both", ls="--", alpha=0.5)
    plt.legend()
    plt.tight_layout()
    plt.savefig("3_1_result.png", dpi=150)

run_benchmark()
