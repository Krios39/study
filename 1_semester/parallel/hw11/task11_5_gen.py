import os
import sys

import numpy as np

ROWS, COLS, PARTS = 2000, 500, 4


def main(folder="matrix_large", vector_file="vector_large.txt", expected_file="expected_large.txt"):
    rng = np.random.default_rng(11)
    a = rng.integers(-9, 10, size=(ROWS, COLS)).astype(float)
    x = np.round(rng.uniform(-1, 1, size=COLS), 3)
    os.makedirs(folder, exist_ok=True)
    for p, block in enumerate(np.array_split(np.arange(ROWS), PARTS)):
        with open(f"{folder}/part{p}.csv", "w") as f:
            for i in block:
                f.write(f"{i}," + ",".join(f"{v:g}" for v in a[i]) + "\n")
    with open(vector_file, "w") as f:
        f.write("\n".join(f"{v:g}" for v in x) + "\n")
    b = a @ x
    with open(expected_file, "w") as f:
        f.write("".join(f"{i}\t{float(v)!r}\n" for i, v in enumerate(b)))


if __name__ == "__main__":
    main(*sys.argv[1:])
