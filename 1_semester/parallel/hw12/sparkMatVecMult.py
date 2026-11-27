import sys
import timeit

import numpy as np
from pyspark.sql import SparkSession


def parse_args(argv):
    if len(argv) < 4:
        print("Usage: sparkMatVecMult.py rows columns partitions [repeats] [check]", file=sys.stderr)
        sys.exit(2)
    rows, cols, partitions = int(argv[1]), int(argv[2]), int(argv[3])
    repeats = int(argv[4]) if len(argv) > 4 else 1
    check = len(argv) > 5 and argv[5] == "check"
    return rows, cols, partitions, repeats, check


def multiply(sc, A, x, partitions):
    Aspark = sc.parallelize(A, partitions)
    b = Aspark.map(lambda row: float(np.dot(row, x)))
    return np.array(b.collect())


def main():
    rows, cols, partitions, repeats, check = parse_args(sys.argv)

    spark = SparkSession.builder.appName("SparkMatVec").getOrCreate()
    sc = spark.sparkContext
    sc.setLogLevel("WARN")

    rng = np.random.default_rng(12)
    A = rng.random((rows, cols))
    x = rng.random(cols)

    times = []
    result = None
    for r in range(repeats):
        start = timeit.default_timer()
        result = multiply(sc, A, x, partitions)
        stop = timeit.default_timer()
        times.append(stop - start)
        print(f"run {r + 1}: Time taken: {stop - start:.4f}")

    print(f"rows={rows} cols={cols} partitions={partitions} master={sc.master} "
          f"defaultParallelism={sc.defaultParallelism}")
    print(f"Time taken (median of {repeats}): {float(np.median(times)):.4f}")
    if rows <= 20:
        print("b =", result)
    else:
        print(f"b (first 5 of {rows}) =", result[:5])

    if check:
        desired = np.matmul(A, x)
        np.testing.assert_allclose(result, desired)
        print("check OK: result matches np.matmul(A, x)")

    spark.stop()


if __name__ == "__main__":
    main()
