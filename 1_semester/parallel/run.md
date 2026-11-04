docker run -it --name paralle -v "C:\учёба\study\1_semester\parallel:/workspace" -w /workspace ubuntu:22.04 bash

ssh -i "C:\учёба\study\1_semester\parallel\parcomp_key" nechshadimov@172.17.66.61

.\pull.ps1 -TargetDir "./hw1" sources/hw1

ssh -i "C:\учёба\study\1_semester\parallel\parcomp_key" -N -o ExitOnForwardFailure=yes -L 127.0.0.1:8766:127.0.0.1:8765 nechshadimov@172.17.66.61
