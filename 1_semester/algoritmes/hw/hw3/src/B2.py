import json
from bisect import bisect_left
from hashlib import sha256
from itertools import accumulate
import random

def changing_zipf_stream(n_keys=1023, n_queries=100_000, phase_length=10_000, s=1.2, noise=0.05, seed=2026):
    rng = random.Random(seed)
    cdf = list(accumulate(1.0 / rank**s for rank in range(1, n_keys + 1)))
    normalizer = cdf[-1]
    stream = []
    for phase_start in range(0, n_queries, phase_length):
        rank_to_key = list(range(n_keys))
        rng.shuffle(rank_to_key)
        phase_size = min(phase_length, n_queries - phase_start)
        for _ in range(phase_size):
            if rng.random() < noise:
                key = rng.randrange(n_keys)
            else:
                rank = bisect_left(cdf, rng.random() * normalizer)
                key = rank_to_key[rank]
            stream.append(key)
    return stream

def stream_checksum(stream):
    data = ",".join(map(str, stream)).encode("ascii")
    return sha256(data).hexdigest()

class Node:
    def __init__(self, key, parent=None):
        self.key = key
        self.left = None
        self.right = None
        self.parent = parent

def build_perfect_tree(start, end, parent=None):
    """Builds a perfectly balanced BST choosing lower median first."""
    if start > end: return None
    mid = start + (end - start) // 2
    node = Node(mid, parent)
    node.left = build_perfect_tree(start, mid - 1, node)
    node.right = build_perfect_tree(mid + 1, end, node)
    return node

def rotate_up(node, root):
    """Performs a single parent-child rotation, moving the node upwards."""
    p = node.parent
    if p is None: return root
    g = p.parent

    if p.left == node:
        y = node.right
        p.left = y
        if y: y.parent = p
        node.right = p
        p.parent = node
    else:
        y = node.left
        p.right = y
        if y: y.parent = p
        node.left = p
        p.parent = node

    node.parent = g
    if g is None:
        root = node
    elif g.left == p:
        g.left = node
    else:
        g.right = node
    return root

def run_simulation(stream, k):
    """Runs the stream on a fresh perfectly balanced tree and applies policy k."""
    root = build_perfect_tree(0, 1022)
    comparisons = 0
    rotations = 0

    for key in stream:
        curr = root
        while curr is not None:
            comparisons += 1
            if key == curr.key:
                break
            elif key < curr.key:
                curr = curr.left
            else:
                curr = curr.right

        if curr is not None:
            moves = 1000000 if k == -1 else k
            for _ in range(moves):
                if curr.parent is None:
                    break
                root = rotate_up(curr, root)
                rotations += 1

    return comparisons, rotations

if __name__ == "__main__":
    print(f"Default Checksum Check: {stream_checksum(changing_zipf_stream())}")
    print("-" * 50)

    phase_lengths = [20, 50, 200, 1000, 10000]
    policies = [0, 1, 2, -1] #

    for pl in phase_lengths:
        stream = changing_zipf_stream(phase_length=pl)
        print(f"\nPhase Length L={pl} (Checksum: {stream_checksum(stream)})")
        print(f"{'Policy':<10} | {'Comparisons (C)':<15} | {'Rotations (R)':<15}")
        print("-" * 50)

        for k in policies:
            c, r = run_simulation(stream, k)
            k_name = "k = inf" if k == -1 else f"k = {k}"
            print(f"{k_name:<10} | {c:<15,} | {r:<15,}")