#!/bin/bash
for P in 1 4 9 16 25 36; do
  sbatch --exclusive -N 1 --ntasks-per-node=$P -J mm_1x$P task10.sbatch
done
for K in 4 9 16; do
  sbatch -N $K --ntasks-per-node=1 -J mm_${K}x1 task10.sbatch --strong 7200 --weak
done
squeue -u $USER
