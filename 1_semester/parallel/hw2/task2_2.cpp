/******************************************************************************
 * FILE: omp_mm.c
 *
 * https://hpc.llnl.gov/tuts/openMP/samples/C/omp_mm.c
 *
 * DESCRIPTION:
 *   OpenMp Example - Matrix Multiply - C Version
 *   Demonstrates a matrix multiply using OpenMP. Threads share row iterations
 *   according to a predefined chunk size.
 * AUTHOR: Blaise Barney
 * LAST REVISED: 06/28/05
 ******************************************************************************/
#include <math.h>
#include <omp.h>
#include <stdio.h>
#include <stdlib.h>

#define NRA 500 /* number of rows in matrix A */
#define NCA 500 /* number of columns in matrix A */
#define NCB 500 /* number of columns in matrix B */

int main(int argc, char *argv[]) {
  int tid, nthreads, i, j, k, chunk;

  double *a = (double *)malloc(NRA * NCA * sizeof(double));
  double *b = (double *)malloc(NCA * NCB * sizeof(double));
  double *c = (double *)malloc(NRA * NCB * sizeof(double));

  if (!a || !b || !c) {
    fprintf(stderr, "Failed to allocate memory!\n");
    return 1;
  }
  // double a[NRA][NCA], /* matrix A */
  //        b[NCA][NCB], /* matrix B */
  //        c[NRA][NCB]; /* result matrix C */

  if (argc > 1) {
    omp_set_num_threads(atoi(argv[1]));
  }

  chunk = 10; /* loop iteration chunk size */

#pragma omp parallel shared(a, b, c, chunk) private(i, j)
  {
#pragma omp for schedule(static, chunk)
    for (i = 0; i < NRA; i++)
      for (j = 0; j < NCA; j++)
        a[i * NCA + j] = i + j;

#pragma omp for schedule(static, chunk)
    for (i = 0; i < NCA; i++)
      for (j = 0; j < NCB; j++)
        b[i * NCB + j] = i * j;

#pragma omp for schedule(static, chunk)
    for (i = 0; i < NRA; i++)
      for (j = 0; j < NCB; j++)
        c[i * NCB + j] = 0.0;
  }

  double start_time = omp_get_wtime();

#pragma omp parallel shared(a, b, c, chunk) private(i, j, k)
  {
#pragma omp for schedule(static, chunk)
    for (i = 0; i < NRA; i++) {
      for (j = 0; j < NCB; j++) {
        double sum = 0.0;
        for (k = 0; k < NCA; k++) {
          sum += a[i * NCA + k] * b[k * NCB + j];
        }
        c[i * NCB + j] = sum;
      }
    }
  }

  double end_time = omp_get_wtime();
  double elapsed_time = end_time - start_time;

  /* a[i][k] = i + k, b[k][j] = k * j
     c[i][j] = sum_{k=0}^{NCA-1} (i + k) * (k * j)
             = j * [ i * sum(k) + sum(k^2) ] */
  double sum_k = (double)(NCA - 1) * NCA / 2.0;
  double sum_k2 = (double)(NCA - 1) * NCA * (2 * (NCA - 1) + 1) / 6.0;

  int correct = 1;
  for (i = 0; i < NRA && correct; i++) {
    for (j = 0; j < NCB && correct; j++) {
      double expected = (double)j * ((double)i * sum_k + sum_k2);
      if (fabs(c[i * NCB + j] - expected) > 1e-3) {
        correct = 0;
      }
    }
  }

  printf("Threads: %d | Time: %f s | Correct: %s | _OPENMP: %d\n",
         (argc > 1 ? atoi(argv[1]) : omp_get_max_threads()), elapsed_time,
         correct ? "YES" : "NO", _OPENMP);

  return 0;
}
