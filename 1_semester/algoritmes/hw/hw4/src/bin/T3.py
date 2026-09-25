import heapq
import random
import time
import statistics
import matplotlib.pyplot as plt

def run_experiment():
    sizes = [10_000, 50_000, 100_000, 500_000, 1_000_000, 2_000_000]
    repetitions = 5

    results_heapify = []
    results_sorted = []
    results_drain = []

    crossover_size = None

    print(f"{'Size (n)':<12} | {'heapify (s)':<15} | {'sorted (s)':<15} | {'heapify+drain (s)':<17}")
    print("-" * 65)

    for n in sizes:
        times_heapify = []
        times_sorted = []
        times_drain = []

        for _ in range(repetitions):
            # Генерация данных (не входит в таймер)
            base_array = random.sample(range(n * 10), n)

            # Копии для независимых тестов
            arr1 = base_array.copy()
            arr2 = base_array.copy()
            arr3 = base_array.copy()

            # 1. Только heapify
            t0 = time.perf_counter()
            heapq.heapify(arr1)
            t1 = time.perf_counter()
            times_heapify.append(t1 - t0)

            # 2. Встроенный sorted
            t0 = time.perf_counter()
            sorted_arr = sorted(arr2)
            t1 = time.perf_counter()
            times_sorted.append(t1 - t0)

            # 3. Heapify + Draining
            t0 = time.perf_counter()
            heapq.heapify(arr3)
            drained_arr = [heapq.heappop(arr3) for _ in range(len(arr3))]
            t1 = time.perf_counter()
            times_drain.append(t1 - t0)

            # Проверка корректности (только один раз за размер)
            assert sorted_arr == drained_arr, "Sorting results do not match!"

        # Считаем медианы
        med_heapify = statistics.median(times_heapify)
        med_sorted = statistics.median(times_sorted)
        med_drain = statistics.median(times_drain)

        results_heapify.append(med_heapify)
        results_sorted.append(med_sorted)
        results_drain.append(med_drain)

        print(f"{n:<12} | {med_heapify:<15.6f} | {med_sorted:<15.6f} | {med_drain:<17.6f}")

        if crossover_size is None and med_heapify < med_sorted:
            crossover_size = n

    print("-" * 65)
    print(f"Crossover found! heapify is faster than sorted starting at size: {crossover_size}")
    print("Correctness check passed: Method 2 (sorted) and Method 3 (drain) produced identical results.")

    plt.figure(figsize=(10, 6))
    plt.plot(sizes, results_heapify, marker='o', label='heapq.heapify only (Θ(n))')
    plt.plot(sizes, results_sorted, marker='s', label='sorted() (Θ(n log n))')
    plt.plot(sizes, results_drain, marker='^', label='heapify + heappop drain (Θ(n log n))')

    plt.title('Performance Comparison: Heapify vs Sorted vs Heap Draining')
    plt.xlabel('Input Size (n)')
    plt.ylabel('Median Time (seconds)')
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig('T3_plot.png')
    plt.show()

print("Prediction: heapify + drain will be the slowest due to Python loop overhead.")
print("sorted() is highly optimized in C (Timsort) and will be fast, but since its complexity is O(n log n),")
print("the O(n) heapify should eventually overtake it at a large enough n.\n")
run_experiment()
