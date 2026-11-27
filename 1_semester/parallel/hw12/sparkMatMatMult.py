import sys
import timeit

import numpy as np
from pyspark.mllib.linalg import Matrices
from pyspark.mllib.linalg.distributed import BlockMatrix
from pyspark.sql import SparkSession


def block_values(seed, matrix_id, i, j, rows, cols):
    rng = np.random.default_rng([seed, matrix_id, i, j])
    return rng.random((rows, cols))


def make_block(seed, matrix_id, block_rows, block_cols):
    def build(ij):
        i, j = ij
        values = block_values(seed, matrix_id, i, j, block_rows, block_cols)
        return (i, j), Matrices.dense(block_rows, block_cols, values.flatten(order="F"))
    return build


def distributed_matrix(sc, seed, matrix_id, row_blocks, col_blocks, block_rows, block_cols, partitions):
    indices = [(i, j) for i in range(row_blocks) for j in range(col_blocks)]
    blocks = sc.parallelize(indices, partitions).map(make_block(seed, matrix_id, block_rows, block_cols))
    return BlockMatrix(blocks, block_rows, block_cols,
                       row_blocks * block_rows, col_blocks * block_cols)


def local_matrix(seed, matrix_id, row_blocks, col_blocks, block_rows, block_cols):
    return np.block([[block_values(seed, matrix_id, i, j, block_rows, block_cols)
                      for j in range(col_blocks)] for i in range(row_blocks)])


def main():
    if len(sys.argv) < 4:
        print("Usage: sparkMatMatMult.py n block_size partitions [check]", file=sys.stderr)
        sys.exit(2)
    n, block, partitions = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
    check = len(sys.argv) > 4 and sys.argv[4] == "check"
    if n % block:
        print("n must be divisible by block_size", file=sys.stderr)
        sys.exit(2)
    nb = n // block
    seed = 12

    spark = SparkSession.builder.appName("SparkMatMat").getOrCreate()
    sc = spark.sparkContext
    sc.setLogLevel("WARN")

    start = timeit.default_timer()
    A = distributed_matrix(sc, seed, 0, nb, nb, block, block, partitions)
    B = distributed_matrix(sc, seed, 1, nb, nb, block, block, partitions)
    C = A.multiply(B)
    trace = C.blocks.filter(lambda b: b[0][0] == b[0][1]) \
                    .map(lambda b: float(np.trace(b[1].toArray()))).sum()
    stop = timeit.default_timer()

    print(f"n={n} block={block} blocks={nb}x{nb} partitions={partitions} master={sc.master}")
    print(f"A partitions={A.blocks.getNumPartitions()} B partitions={B.blocks.getNumPartitions()} "
          f"C partitions={C.blocks.getNumPartitions()}")
    print(f"trace(C) = {trace:.6f}")
    print(f"Time taken: {stop - start:.4f}")

    if check:
        result = C.toLocalMatrix().toArray()
        desired = local_matrix(seed, 0, nb, nb, block, block) @ local_matrix(seed, 1, nb, nb, block, block)
        np.testing.assert_allclose(result, desired)
        print("C[0, :4] =", result[0, :4])
        print("check OK: result matches numpy A @ B")

    spark.stop()


if __name__ == "__main__":
    main()
