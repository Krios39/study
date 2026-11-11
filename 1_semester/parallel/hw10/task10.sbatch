#!/bin/bash
#SBATCH -J matmul10
#SBATCH -N 1
#SBATCH --ntasks-per-node=4
#SBATCH --mem=16000
#SBATCH -t 00:10:00
#SBATCH --partition=amd

module purge
module load openmpi/4.1.0
module load py-mpi4py/3.1.4
module list 2>&1
module load py-numpy/1.23.5
python3 -c "import sys, numpy, mpi4py; print(sys.version.split()[0], numpy.__version__, mpi4py.__version__)"

export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1
export UCX_LOG_LEVEL=error

echo "job $SLURM_JOB_ID: nodes=$SLURM_JOB_NUM_NODES tasks=$SLURM_NTASKS nodelist=$SLURM_JOB_NODELIST"
lscpu | grep -E "Model name|^CPU\(s\)"
mpirun -np $SLURM_NTASKS python3 task10_bench.py "$@"
