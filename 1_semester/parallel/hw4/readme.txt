# Assignment 4: MPI Collectives and Performance

## Environment Settings
Before running any performance benchmarks (Exercise 4.3 and Bonus 4.4), you MUST disable nested threading to prevent OpenMPI and NumPy from creating an uncontrolled second level of parallelism. 

Run these commands in your terminal before execution:
export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1

Note: For runs requiring 8 processes (P=8) on a machine with fewer than 8 physical cores, the `--oversubscribe` flag is required.

## File Descriptions & Launch Commands

1. Exercise 4.1.1 (Trapezoidal integration using MPI.Reduce)
File: task4_1.py
Run: mpiexec -n <P> python3 task4_1.py <a_limit> <b_limit> <n_trapezoids>
Example: mpiexec -n 4 python3 task4_1.py 0.0 1.0 10000

2. Exercise 4.1.2 (Basic repeated matrix-vector multiplication using MPI.Allgather)
File: task4_1_2.py
Run: mpiexec -n <P> python3 task4_1_2.py <N_size> <K_iterations>
Example: mpiexec -n 4 python3 task4_1_2.py 1000 10

3. Exercise 4.2 (Row-block implementation & tests)
Files: task4_2.py (or a4_solution.py), a4_test.py
Run (Testing): mpiexec -n 4 python3 a4_test.py task4_2.py

4. Exercise 4.3 (Reproducible strong-scaling experiment)
File: task4_3.py (Contains the benchmarking script with N=4096, K=50)
Run: mpiexec -n 4 python3 task4_3.py

5. Bonus Exercise 4.4 (Row-cyclic distribution & Arbitrary N)
File: task4_bonus.py
Run (Correctness with a4_test): mpiexec -n 4 python3 a4_test.py task4_bonus.py
Run (Arbitrary N proof, N=65, P=4): 
mpiexec -n 4 python3 -c "import task4_bonus, numpy as np; comm = task4_bonus.MPI.COMM_WORLD; rank = comm.Get_rank(); size = comm.Get_size(); N = 65; local_N = N // size + (1 if rank < N % size else 0); A = np.ones((N, N)); x = np.ones(N); task4_bonus.Ax_rowcyclic(A, x, 2); print(f'Rank {rank} handled {local_N} rows and finished successfully.')"

## Additional Files
- report.html (or .pdf): Contains design notes, performance plots, raw terminal outputs, and scaling analysis.
- timing_data.csv: Raw median timing results for the strong-scaling experiment.