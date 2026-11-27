#!/bin/bash
setup=$(sbatch --parsable setup_env.sbatch)
for cores in 1 2 4 8 16; do
  sbatch --dependency=afterok:$setup --cpus-per-task=$cores -J nechspark_c$cores sparkjob.sbatch 32000 128000
done
squeue -u $USER
