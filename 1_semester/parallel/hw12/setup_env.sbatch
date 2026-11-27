#!/bin/bash
#SBATCH -J nechspark_setup
#SBATCH -N 1
#SBATCH --ntasks-per-node=1
#SBATCH --cpus-per-task=1
#SBATCH --mem=4000
#SBATCH -t 00:20:00
#SBATCH --output=setup-%j.out

module load python/3.9.12
module load py-virtualenv/20.22.0
module load openjdk/17.0.3_7

virtualenv --no-download sparkenv2
source sparkenv2/bin/activate
pip install pyspark numpy
python -c "import pyspark, numpy, sys; print(sys.version.split()[0], pyspark.__version__, numpy.__version__)"
