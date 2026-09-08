from time import perf_counter

counter = 0


def my_fib(n):
    global counter
    counter += 1
    if n == 0:
        return 0
    elif n == 1:
        return 1
    else:
        return my_fib(n - 1) + my_fib(n - 2)


itr_counter = 0


def itr_fib(n):
    global itr_counter
    if n == 0:
        return 0
    else:
        fib = [0] * n
        fib.insert(1, 1)
        for i in range(2, n + 1):
            itr_counter += 1
            fib[i] = fib[i - 1] + fib[i - 2]
    return fib[n]


def benchmark_fib(n):
    global counter, itr_counter

    counter = 0
    t_start_1 = perf_counter()
    my_fib(n)
    t_elapsed_1 = perf_counter() - t_start_1
    calls_rec = counter

    itr_counter = 0
    t_start_2 = perf_counter()
    res_itr = itr_fib(n)
    t_elapsed_2 = perf_counter() - t_start_2
    calls_itr = itr_counter

    print(f"\n--- Benchmark for n = {n} ---")
    print(f"Result: {res_itr}")
    print(
        f"Iterative: {t_elapsed_2:.8f} s  (inner loop steps: {calls_itr})"
    )
    print(
        f"Recursive: {t_elapsed_1:.8f} s  (function calls:   {calls_rec})"
    )
    if t_elapsed_2 > 0:
        print(f"Speedup:   Iterative is ~{t_elapsed_1 / t_elapsed_2:.1f}x faster")


print("Fibonacci of 4, 7, 14, 21")
print(f"Iterative = {itr_fib(4)} : Recursive = {my_fib(4)}")
print(f"Iterative = {itr_fib(7)} : Recursive = {my_fib(7)}")
print(f"Iterative = {itr_fib(14)} : Recursive = {my_fib(14)}")
print(f"Iterative = {itr_fib(21)} : Recursive = {my_fib(21)}")

for n in [4, 7, 14, 21, 28, 32]:
    benchmark_fib(n)
