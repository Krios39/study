#ifndef TS
#define TS 16
#endif

__kernel void matmul_tiled(const int N,
                           __global const float* A,
                           __global const float* B,
                           __global float* C)
{
    const int col = get_global_id(0);
    const int row = get_global_id(1);
    const int lc = get_local_id(0);
    const int lr = get_local_id(1);

    __local float As[TS][TS];
    __local float Bs[TS][TS];

    float acc = 0.0f;
    for (int t = 0; t < N; t += TS) {
        As[lr][lc] = A[row * N + t + lc];
        Bs[lr][lc] = B[(t + lr) * N + col];
        barrier(CLK_LOCAL_MEM_FENCE);
        for (int k = 0; k < TS; k++)
            acc += As[lr][k] * Bs[k][lc];
        barrier(CLK_LOCAL_MEM_FENCE);
    }
    C[row * N + col] = acc;
}

__kernel void kernel_A(const int N,
                       __global const float* A,
                       __global const float* B,
                       __global float* C)
{
    const int gid = get_global_id(0);
    const int row = gid / N;
    const int col = gid % N;

    float acc = 0.0f;
    for (int k = 0; k < N; k++)
        acc += A[row * N + k] * B[k * N + col];
    C[gid] = acc;
}

__kernel void kernel_B(const int N,
                       __global const float* A,
                       __global const float* B,
                       __global float* C,
                       __local float* Arow)
{
    const int gid = get_global_id(0);
    const int row = gid / N;
    const int col = gid % N;
    const int lid = get_local_id(0);
    const int L = get_local_size(0);

    float acc = 0.0f;
    for (int k0 = 0; k0 < N; k0 += L) {
        Arow[lid] = A[row * N + k0 + lid];
        barrier(CLK_LOCAL_MEM_FENCE);
        for (int k = 0; k < L; k++)
            acc += Arow[k] * B[(k0 + k) * N + col];
        barrier(CLK_LOCAL_MEM_FENCE);
    }
    C[gid] = acc;
}
