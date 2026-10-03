"""Reproducible input stream for HW5 Task 3 (Python standard library only).

Usage from another Python file in the same directory::

    from HW5_stream import stream

    for value_id in stream():
        ...  # Process this event in your own implementation.

The default stream contains 10,000,000 events with value IDs 0 through 1023.
Its first 1024 events visit each ID once in shuffled order. Later events use
synthetic, unequal probabilities proportional to 1 / rank**1.1, with the ranks
randomly assigned to IDs. This is a documented non-uniform test distribution,
not a secret distribution or a source of security-grade randomness.

The generator does not compute frequencies or implement any counters. It
keeps only O(1024) distribution metadata, not the event stream. Use a separate
random-number generator for your own Morris-counter updates: their random
choices must not change the input data.

Running this file directly prints one ID per line to standard output; it
does not create a file. For example: python3 HW5_stream.py --n 20 --seed 2026
"""

from bisect import bisect_right
from itertools import accumulate
from random import Random
from typing import Iterator


NUM_VALUES = 1024


def stream(n: int = 10_000_000, seed: int = 2026) -> Iterator[int]:
    """Yield n reproducible integer IDs without storing the full stream.

    Calls with the same arguments reproduce the same events and do not touch
    Python's global RNG. Each call owns its RNG, including when generators
    are consumed in an interleaved order. For n >= NUM_VALUES, every ID is
    guaranteed to occur; smaller n returns a prefix of the coverage pass.
    """
    if isinstance(n, bool) or not isinstance(n, int):
        raise TypeError("n must be an integer")
    if n < 0:
        raise ValueError("n must be non-negative")

    rng = Random(seed)
    rank_to_id = list(range(NUM_VALUES))
    rng.shuffle(rank_to_id)

    coverage_pass = rank_to_id.copy()
    rng.shuffle(coverage_pass)
    yield from coverage_pass[:min(n, NUM_VALUES)]
    if n <= NUM_VALUES:
        return

    cumulative = list(accumulate(rank ** -1.1 for rank in range(1, NUM_VALUES + 1)))
    total_weight = cumulative[-1]
    # Normalization leaves the last boundary exactly 1.0; random() is < 1.0.
    cumulative = [weight / total_weight for weight in cumulative]
    for _ in range(n - NUM_VALUES):
        yield rank_to_id[bisect_right(cumulative, rng.random())]


def main() -> None:
    """Optional command-line output; counters belong in the student's code."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n", type=int, default=10_000_000, help="number of events")
    parser.add_argument("--seed", type=int, default=2026, help="input RNG seed")
    args = parser.parse_args()
    if args.n < 0:
        parser.error("--n must be non-negative")
    try:
        for value_id in stream(args.n, args.seed):
            sys.stdout.write(f"{value_id}\n")
    except BrokenPipeError:
        # A downstream reader (for example head) may intentionally stop early.
        return


if __name__ == "__main__":
    main()