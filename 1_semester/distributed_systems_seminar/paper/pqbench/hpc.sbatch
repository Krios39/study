#!/usr/bin/env bash
#SBATCH --job-name=pqbench
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=8G
#SBATCH --time=06:00:00
#SBATCH --exclusive
#SBATCH --output=pqbench-%j.log
set -euo pipefail
HERE=${SLURM_SUBMIT_DIR:-$(pwd)}
cd "$HERE"
{
  echo "slurm job: ${SLURM_JOB_ID:-none} node: $(hostname) partition: ${SLURM_JOB_PARTITION:-?}"
  lscpu | grep -E 'Model name|Socket|Core|Thread|MHz' || true
} > "pqbench-${SLURM_JOB_ID:-local}-node.txt"
bash "$HERE/run.sh"
