import sys

import numpy as np


def load(path):
    rows = [line.split("\t") for line in open(path) if line.strip()]
    return {int(i): float(v) for i, v in rows}


def main(result, expected):
    got, want = load(result), load(expected)
    keys = sorted(want)
    assert sorted(got) == keys, "row sets differ"
    err = np.max(np.abs(np.array([got[k] for k in keys]) - np.array([want[k] for k in keys])))
    print(f"rows={len(keys)} max_abs_error={err:.3e}")


if __name__ == "__main__":
    main(*sys.argv[1:])
