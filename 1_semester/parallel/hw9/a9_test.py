import sys

import numpy as np
from mpi4py import MPI
from numpy.testing import assert_allclose

from task9_1 import manager_worker_AxB


def problems(rng, P):
    known = np.arange(1.0, 37.0).reshape(6, 6)
    yield "known integers N=6", known, known.T.copy(), [1, 2, 3, 6]
    yield "identity x random N=12", np.eye(12), rng.random((12, 12)), [1, 2, 3, 4, 6, 12]
    yield "random x identity N=12", rng.random((12, 12)), np.eye(12), [2, 4]
    yield "zero x random N=8", np.zeros((8, 8)), rng.random((8, 8)), [2, 4]
    yield "N=m=1", np.array([[2.0]]), np.array([[3.0]]), [1]
    yield "random N=60", rng.standard_normal((60, 60)), rng.standard_normal((60, 60)), [1, 2, 3, 5, 6, 10, 12]
    yield "fewer tasks than workers possible N=4 m=1", rng.random((4, 4)), rng.random((4, 4)), [1]
    yield "many tasks N=64 m=16", rng.random((64, 64)), rng.random((64, 64)), [16]
    yield "course test N=5*P m=5", rng.random((5 * P, 5 * P)), rng.random((5 * P, 5 * P)), [5]


def main():
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    rng = np.random.default_rng(9)
    failed = 0
    for name, A, B, ms in problems(rng, comm.Get_size()):
        for m in ms:
            C = manager_worker_AxB(A if rank == 0 else None, B if rank == 0 else None, m, comm)
            comm.Barrier()
            if rank == 0:
                try:
                    assert_allclose(C, np.matmul(A, B), rtol=1e-10, atol=1e-12)
                    print(f"PASS  P={comm.Get_size()}  {name}  m={m}")
                except AssertionError:
                    failed += 1
                    print(f"FAIL  P={comm.Get_size()}  {name}  m={m}")
            else:
                assert C is None
    if rank == 0:
        print("all tests passed" if failed == 0 else f"{failed} tests failed")
    sys.exit(1 if comm.bcast(failed, root=0) else 0)


main()
