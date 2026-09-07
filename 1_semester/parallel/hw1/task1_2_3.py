from statistics import median
from time import perf_counter
import matplotlib.pyplot as plt
import numpy as np
from threadpoolctl import threadpool_limits

N = 2500
threads_list = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]
repeats = 5

rng = np.random.default_rng(2026)
A = rng.random((N, N), dtype=np.float64)
B = rng.random((N, N), dtype=np.float64)


times = []
for p in threads_list:
  with threadpool_limits(limits=p, user_api="blas"):
    runs = []
    for _ in range(repeats):
      t0 = perf_counter()
      _ = A @ B
      runs.append(perf_counter() - t0)

    med = median(runs)
    times.append(med)
    print(f"Threads: {p:3d} | Median time: {med:.4f} s")

t1 = times[0]
speedups = [t1 / tp for tp in times]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
ax1.plot(threads_list, times, marker="o")
ax1.set_xscale("log", base=2)
ax1.set_xlabel("Threads")
ax1.set_ylabel("Time (s)")
ax1.set_title("Execution Time")
ax1.grid(True)

ax2.plot(threads_list, speedups, marker="s", color="green", label="Measured")
ax2.plot(threads_list, threads_list, ":", color="gray", label="Ideal linear")
ax2.set_xscale("log", base=2)
ax2.set_yscale("log", base=2)
ax2.set_xlabel("Threads")
ax2.set_ylabel("Speedup (T1 / Tp)")
ax2.set_title("Speedup")
ax2.legend()
ax2.grid(True)

plt.tight_layout()
plt.savefig("1_2_3_result.png", dpi=150)
