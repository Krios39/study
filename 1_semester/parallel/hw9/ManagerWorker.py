import numpy as np
from mpi4py import MPI
comm = MPI.COMM_WORLD
rank = comm.Get_rank()
size = comm.Get_size()
status = MPI.Status()
if rank==0:
     # Manager sends a message to each worker
    for i in range(1,size):
        A=np.arange(3,dtype='d')*i
        comm.Send(A,dest=i,tag=i*2)
    # ...and waits back a message from each worker:
    for i in range(1,size):
        A=np.empty(3,dtype='d')
        comm.Recv(A,source=MPI.ANY_SOURCE,tag=MPI.ANY_TAG, status=status)
        print('Got back',A,'from ',status.source,' with msg tag',status.tag)
else:
    A=np.empty(3,dtype='d')
    comm.Recv(A,source=0,tag=MPI.ANY_TAG,status=status)
    comm.Send(A,dest=0,tag=status.tag)
