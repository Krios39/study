#!/bin/bash
#SBATCH -N 1
#SBATCH -J nechspark
#SBATCH --mem=16000
#SBATCH --output=sparkjob-%j.out
#SBATCH -t 00:25:00
#SBATCH --cpus-per-task=8
#SBATCH --ntasks-per-node=1

module load python/3.9.12
module load py-virtualenv/20.22.0
module load openjdk/17.0.3_7

source sparkenv2/bin/activate

export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1

cols=1000
partitions=100
repeats=3
cores=${SLURM_CPUS_PER_TASK}

echo "job $SLURM_JOB_ID: node=$SLURM_JOB_NODELIST cores=$cores"
lscpu | grep -E "Model name"

for rows in "$@"; do
  spark-submit --master local[$cores] --executor-memory 1000M --driver-memory 8000M \
    sparkMatVecMult.py $rows $cols $partitions $repeats 2>/dev/null
done
