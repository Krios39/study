from time import perf_counter
import matplotlib.pyplot as plt
import numpy as np


def fib_recursive(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    return fib_recursive(n - 1) + fib_recursive(n - 2)


def power_matrix(x, n):
    if n == 1:
        return x
    if n % 2 == 0:
        matrix = power_matrix(x, n // 2)
        return matrix @ matrix
    else:
        matrix = power_matrix(x, n // 2)
        return x @ (matrix @ matrix)


def matrix_fib(n):
    if n <= 0:
        return 0
    if n == 1:
        return 1
    F_0 = np.array([[0, 1], [1, 1]])
    return power_matrix(F_0, n)[0][1]

np.testing.assert_equal(matrix_fib(0), 0)
np.testing.assert_equal(matrix_fib(1), 1)
np.testing.assert_equal(matrix_fib(2), 1)
np.testing.assert_equal(matrix_fib(45), 1134903170)
np.testing.assert_equal(matrix_fib(90), 2880067194370816120)


n_values = list(range(1, 33))

times_recursive = []
times_matrix = []

for n in n_values:
    t0 = perf_counter()
    _ = fib_recursive(n)
    times_recursive.append(perf_counter() - t0)

    repeats = 500
    t0 = perf_counter()
    for _ in range(repeats):
        _ = matrix_fib(n)
    times_matrix.append((perf_counter() - t0) / repeats)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

ax1.plot(n_values, times_recursive, "r-o", label="Recursive O(2^n)")
ax1.plot(n_values, times_matrix, "b-s", label="Matrix Power O(log n)")
ax1.set_title("Execution Time (Linear Scale)")
ax1.set_xlabel("Fibonacci index (n)")
ax1.set_ylabel("Time (seconds)")
ax1.grid(True)
ax1.legend()

ax2.plot(n_values, times_recursive, "r-o", label="Recursive O(2^n)")
ax2.plot(n_values, times_matrix, "b-s", label="Matrix Power O(log n)")
ax2.set_yscale("log")
ax2.set_title("Execution Time (Log Scale)")
ax2.set_xlabel("Fibonacci index (n)")
ax2.set_ylabel("Time (seconds, log scale)")
ax2.grid(True, which="both", ls="--")
ax2.legend()

plt.tight_layout()
plt.savefig("task1_3_result.png", dpi=300)
