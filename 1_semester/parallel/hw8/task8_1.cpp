#include "ocl_util.h"

#include <omp.h>

#include <cstring>

static void matmul_seq(int N, const float* __restrict A, const float* __restrict B, float* __restrict C)
{
    std::memset(C, 0, sizeof(float) * N * N);
    for (int i = 0; i < N; i++)
        for (int k = 0; k < N; k++) {
            const float a = A[i * N + k];
            const float* __restrict b = B + k * N;
            float* __restrict c = C + i * N;
            for (int j = 0; j < N; j++) c[j] += a * b[j];
        }
}

static void matmul_omp_for(int N, const float* __restrict A, const float* __restrict B, float* __restrict C)
{
#pragma omp parallel for schedule(static)
    for (int i = 0; i < N; i++) {
        float* __restrict c = C + i * N;
        for (int j = 0; j < N; j++) c[j] = 0.0f;
        for (int k = 0; k < N; k++) {
            const float a = A[i * N + k];
            const float* __restrict b = B + k * N;
            for (int j = 0; j < N; j++) c[j] += a * b[j];
        }
    }
}

static const long long GRAIN = 32768;

static void leaf(int N, int mf, int ml, int nf, int nl, int pf, int pl, const float* __restrict A, const float* __restrict B, float* __restrict C)
{
    for (int i = mf; i < ml; i++)
        for (int k = pf; k < pl; k++) {
            const float a = A[i * N + k];
            for (int j = nf; j < nl; j++) C[i * N + j] += a * B[k * N + j];
        }
}

static void rec(int N, int mf, int ml, int nf, int nl, int pf, int pl, const float* A, const float* B, float* C)
{
    if (static_cast<long long>(ml - mf) * (nl - nf) * (pl - pf) < GRAIN) {
        leaf(N, mf, ml, nf, nl, pf, pl, A, B, C);
        return;
    }
    const int mm = mf + (ml - mf) / 2, mn = nf + (nl - nf) / 2, mp = pf + (pl - pf) / 2;
#pragma omp task
    rec(N, mf, mm, nf, mn, pf, mp, A, B, C);
#pragma omp task
    rec(N, mf, mm, mn, nl, pf, mp, A, B, C);
#pragma omp task
    rec(N, mm, ml, nf, mn, pf, mp, A, B, C);
#pragma omp task
    rec(N, mm, ml, mn, nl, pf, mp, A, B, C);
#pragma omp taskwait
#pragma omp task
    rec(N, mf, mm, nf, mn, mp, pl, A, B, C);
#pragma omp task
    rec(N, mf, mm, mn, nl, mp, pl, A, B, C);
#pragma omp task
    rec(N, mm, ml, nf, mn, mp, pl, A, B, C);
#pragma omp task
    rec(N, mm, ml, mn, nl, mp, pl, A, B, C);
#pragma omp taskwait
}

static void matmul_omp_tasks(int N, const float* A, const float* B, float* C)
{
    std::memset(C, 0, sizeof(float) * N * N);
#pragma omp parallel
#pragma omp single
    rec(N, 0, N, 0, N, 0, N, A, B, C);
}

int main(int argc, char** argv)
{
    std::vector<int> sizes;
    int runs = 3;
    int seqMaxRunsBig = 1;
    std::string kernelFile = "matmul_kernels.cl";
    std::string csv = "results_8_1.csv";
    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        if (a == "--runs" && i + 1 < argc) runs = std::atoi(argv[++i]);
        else if (a == "--kernels" && i + 1 < argc) kernelFile = argv[++i];
        else if (a == "--csv" && i + 1 < argc) csv = argv[++i];
        else sizes.push_back(std::atoi(argv[i]));
    }
    if (sizes.empty()) sizes = {512, 1024, 2048, 4096};

    OclContext ocl;
    ocl.print_info();
    std::printf("OpenMP threads: %d\n\n", omp_get_max_threads());

    int ts = ocl.maxWorkGroup >= 256 ? 16 : 8;
    cl_program program = ocl.build(kernelFile, "-cl-std=CL1.2 -DTS=" + std::to_string(ts));
    cl_int err;
    cl_kernel kernel = clCreateKernel(program, "matmul_tiled", &err);
    CL_CHECK(err);

    FILE* out = std::fopen(csv.c_str(), "a");
    std::fseek(out, 0, SEEK_END);
    if (std::ftell(out) == 0) std::fprintf(out, "impl,N,run,seconds,kernel_seconds\n");

    for (int N : sizes) {
        if (N % ts != 0) {
            std::printf("skip N=%d: not divisible by tile size %d\n", N, ts);
            continue;
        }
        std::vector<float> A = random_matrix(N, 1), B = random_matrix(N, 2);
        std::vector<float> Cref(static_cast<size_t>(N) * N), C(static_cast<size_t>(N) * N);
        double gflop = 2.0 * N * N * N * 1e-9;

        auto bench = [&](const char* name, int nruns, auto&& fn, bool isRef) {
            std::vector<double> t;
            for (int r = 0; r < nruns; r++) {
                double t0 = now_s();
                fn(N, A.data(), B.data(), isRef ? Cref.data() : C.data());
                t.push_back(now_s() - t0);
                std::fprintf(out, "%s,%d,%d,%.6f,\n", name, N, r, t.back());
            }
            double m = median(t);
            std::string check = isRef ? "reference" : "max rel. error vs sequential " + std::to_string(max_rel_error(C, Cref));
            std::printf("%-10s N=%5d  median %9.4f s  (min %.4f, max %.4f, %d runs)  %7.2f GFLOP/s  %s\n", name, N, m,
                        *std::min_element(t.begin(), t.end()), *std::max_element(t.begin(), t.end()), nruns,
                        gflop / m, check.c_str());
            std::fflush(stdout);
        };

        bench("sequential", N >= 2048 ? seqMaxRunsBig : runs, matmul_seq, true);
        bench("omp_for", runs, matmul_omp_for, false);
        bench("omp_tasks", runs, matmul_omp_tasks, false);

        size_t global[2] = {static_cast<size_t>(N), static_cast<size_t>(N)};
        size_t local[2] = {static_cast<size_t>(ts), static_cast<size_t>(ts)};
        run_matmul_on_gpu(ocl, kernel, N, A, B, C, 2, global, local, 0);
        std::vector<double> tk, tt;
        for (int r = 0; r < runs; r++) {
            GpuRun g = run_matmul_on_gpu(ocl, kernel, N, A, B, C, 2, global, local, 0);
            tk.push_back(g.kernel);
            tt.push_back(g.total);
            std::fprintf(out, "opencl,%d,%d,%.6f,%.6f\n", N, r, g.total, g.kernel);
        }
        std::printf("%-10s N=%5d  median %9.4f s  (kernel only %.4f s, %d runs)  %7.2f GFLOP/s (kernel %.2f)  "
                    "max rel. error vs sequential %g\n\n",
                    "opencl", N, median(tt), median(tk), runs, gflop / median(tt), gflop / median(tk),
                    max_rel_error(C, Cref));
        std::fflush(stdout);
        std::fflush(out);
    }

    std::fclose(out);
    clReleaseKernel(kernel);
    clReleaseProgram(program);
    return 0;
}
