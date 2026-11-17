import glob
import re
import sys
from statistics import median


def lengths(folder):
    out = []
    for path in sorted(glob.glob(f"{folder}/*")):
        text = open(path, encoding="utf-8").read().lstrip("﻿")
        out.extend(len(t.encode("utf-16-le")) // 2 for t in re.split(r"[ \t\n\r\f]+", text) if t)
    return out


def main(*folders):
    for folder in folders:
        values = lengths(folder)
        print(f"{folder}: words={len(values)} median={median(values)}")


if __name__ == "__main__":
    main(*sys.argv[1:])
