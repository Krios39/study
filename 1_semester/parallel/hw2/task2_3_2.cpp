#include <stdio.h>
#include <stdlib.h>
#include <omp.h>
#include "2DArray.h"

#define MM 1000
#define NN 1000
#define PP 1000

double dabs(double d) { return (d >= 0.0 ? d : (-d)); }

void matmult1(int m, int n, int p, double **A, double **B, double **C)
{
    int i, j, k;
    for (i = 0; i < m; i++) {
        for (j = 0; j < n; j++) {
            C[i][j] = 0;
            for (k = 0; k < p; k++) {
                C[i][j] += A[i][k] * B[k][j];
            }
        }
    }
}

void matmultleaf(int mf, int ml, int nf, int nl, int pf, int pl, double **A, double **B, double **C)
{
    int i, j, k;
    for (i = mf; i < ml; i++) {
        for (j = nf; j < nl; j++) {
            for (k = pf; k < pl; k++) {
                C[i][j] += A[i][k] * B[k][j];
            }
        }
    }
}

#define GRAIN 32768

void matmultrec(int mf, int ml, int nf, int nl, int pf, int pl, double **A, double **B, double **C)
{
    if ((long long)(ml - mf) * (nl - nf) * (pl - pf) < GRAIN) {
        matmultleaf(mf, ml, nf, nl, pf, pl, A, B, C);
    } else {
        int mid_m = mf + (ml - mf) / 2;
        int mid_n = nf + (nl - nf) / 2;
        int mid_p = pf + (pl - pf) / 2;

        #pragma omp task
        matmultrec(mf, mid_m, nf, mid_n, pf, mid_p, A, B, C);   // C00 += A00 * B00

        #pragma omp task
        matmultrec(mf, mid_m, mid_n, nl, pf, mid_p, A, B, C);   // C01 += A00 * B01

        #pragma omp task
        matmultrec(mid_m, ml, nf, mid_n, pf, mid_p, A, B, C);   // C10 += A10 * B00

        #pragma omp task
        matmultrec(mid_m, ml, mid_n, nl, pf, mid_p, A, B, C);   // C11 += A10 * B01

        #pragma omp taskwait

        #pragma omp task
        matmultrec(mf, mid_m, nf, mid_n, mid_p, pl, A, B, C);   // C00 += A01 * B10

        #pragma omp task
        matmultrec(mf, mid_m, mid_n, nl, mid_p, pl, A, B, C);   // C01 += A01 * B11

        #pragma omp task
        matmultrec(mid_m, ml, nf, mid_n, mid_p, pl, A, B, C);   // C10 += A11 * B10

        #pragma omp task
        matmultrec(mid_m, ml, mid_n, nl, mid_p, pl, A, B, C);   // C11 += A11 * B11

        #pragma omp taskwait
    }
}

void matmultr(int m, int n, int p, double **A, double **B, double **C)
{
    int i, j;
    for (i = 0; i < m; i++) {
        for (j = 0; j < n; j++) {
            C[i][j] = 0.0;
        }
    }

    #pragma omp parallel
    {
        #pragma omp single
        {
            matmultrec(0, m, 0, n, 0, p, A, B, C);
        }
    }
}

int CheckResults(int m, int n, double **C, double **C1)
{
#define ERR_THRESHOLD 0.001
    for (int i = 0; i < m; i++) {
        for (int j = 0; j < n; j++) {
            if (dabs(C[i][j] - C1[i][j]) > ERR_THRESHOLD) {
                printf("Mismatch: %f vs %f at [%d][%d]\n", C[i][j], C1[i][j], i, j);
                return 1;
            }
        }
    }
    return 0;
}

int main(int argc, char* argv[])
{
    int i, j;
    double start, time1, time2;

    int M = MM;
    int N = NN;
    int P = PP;

    if (argc >= 4) {
        M = atoi(argv[1]);
        N = atoi(argv[2]);
        P = atoi(argv[3]);
    } else {
        printf("Suggested Usage: %s <M> <N> <P> [num_threads]\n", argv[0]);
        printf("Using default sizes: %d x %d x %d\n", M, N, P);
    }

    if (argc >= 5) {
        omp_set_num_threads(atoi(argv[4]));
    }

    double **A  = Allocate2DArray<double>(M, P);
    double **B  = Allocate2DArray<double>(P, N);
    double **C1 = Allocate2DArray<double>(M, N);
    double **C4 = Allocate2DArray<double>(M, N);

    for (i = 0; i < M; i++) {
        for (j = 0; j < P; j++) {
            A[i][j] = (double)(rand() % 100) / 10.0;
        }
    }

    for (i = 0; i < P; i++) {
        for (j = 0; j < N; j++) {
            B[i][j] = (double)(rand() % 100) / 10.0;
        }
    }

    printf("Matrix Dimensions: M = %d, P = %d, N = %d | Max Threads = %d\n",
           M, P, N, omp_get_max_threads());

    printf("Executing matmult1 (naive serial)...\n");
    start = omp_get_wtime();
    matmult1(M, N, P, A, B, C1);
    time1 = omp_get_wtime() - start;
    printf("Time = %f seconds\n\n", time1);

    printf("Executing matmultr (parallel tasks)...\n");
    start = omp_get_wtime();
    matmultr(M, N, P, A, B, C4);
    time2 = omp_get_wtime() - start;
    printf("Time = %f seconds\n\n", time2);

    printf("Checking...");
    if (CheckResults(M, N, C1, C4)) {
        printf("Error in Recursive Matrix Multiplication\n\n");
    } else {
        printf("OKAY\n\n");
        printf("Speedup vs naive (matmult1 / matmultr) = %5.1fX\n", time1 / time2);
    }

    Free2DArray<double>(A);
    Free2DArray<double>(B);
    Free2DArray<double>(C1);
    Free2DArray<double>(C4);

    return 0;
}
