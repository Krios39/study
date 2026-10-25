#include "ocl_util.h"

struct Config {
    int N;
    int localA;
    int localB;
};

static double sampled_error(int N, const std::vector<float>& A, const std::vector<float>& B, const std::vector<float>& C)
{
    std::mt19937 gen(7);
    std::uniform_int_distribution<int> pick(0, N - 1);
    double maxRef = 0, maxDiff = 0;
    for (int s = 0; s < 256; s++) {
        int i = pick(gen), j = pick(gen);
        double ref = 0;
        for (int k = 0; k < N; k++) ref += static_cast<double>(A[i * N + k]) * B[k * N + j];
        maxRef = std::max(maxRef, std::fabs(ref));
        maxDiff = std::max(maxDiff, std::fabs(ref - C[i * N + j]));
    }
    return maxDiff / maxRef;
}

int main(int argc, char** argv)
{
    int runs = 3;
    std::string kernelFile = "matmul_kernels.cl";
    std::string csv = "results_8_2.csv";
    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        if (a == "--runs" && i + 1 < argc) runs = std::atoi(argv[++i]);
        else if (a == "--kernels" && i + 1 < argc) kernelFile = argv[++i];
        else if (a == "--csv" && i + 1 < argc) csv = argv[++i];
    }
    const std::vector<Config> configs = {{1024, 2, 8}, {2048, 2, 32}, {4096, 2, 64}};

    OclContext ocl;
    ocl.print_info();
    std::printf("\n");

    cl_program program = ocl.build(kernelFile, "-cl-std=CL1.2");
    cl_int err;
    cl_kernel kA = clCreateKernel(program, "kernel_A", &err);
    CL_CHECK(err);
    cl_kernel kB = clCreateKernel(program, "kernel_B", &err);
    CL_CHECK(err);

    FILE* out = std::fopen(csv.c_str(), "a");
    std::fseek(out, 0, SEEK_END);
    if (std::ftell(out) == 0) std::fprintf(out, "kernel,N,local_item_size,run,seconds,kernel_seconds\n");

    for (const Config& cfg : configs) {
        const int N = cfg.N;
        std::vector<float> A = random_matrix(N, 1), B = random_matrix(N, 2);
        std::vector<float> CA(static_cast<size_t>(N) * N), CB(static_cast<size_t>(N) * N);
        double gflop = 2.0 * N * N * N * 1e-9;
        size_t global = static_cast<size_t>(N) * N;

        struct Item {
            const char* name;
            cl_kernel kernel;
            int local;
            std::vector<float>* C;
        };
        Item items[2] = {{"kernel_A", kA, cfg.localA, &CA}, {"kernel_B", kB, cfg.localB, &CB}};

        for (Item& it : items) {
            size_t local = static_cast<size_t>(it.local);
            if (local > ocl.maxWorkGroup || N % it.local != 0) {
                std::printf("%s N=%d: local_item_size %d not allowed on this device (max %zu)\n", it.name, N, it.local,
                            ocl.maxWorkGroup);
                continue;
            }
            size_t localBytes = it.kernel == kB ? local * sizeof(float) : 0;
            run_matmul_on_gpu(ocl, it.kernel, N, A, B, *it.C, 1, &global, &local, localBytes);
            std::vector<double> tk, tt;
            for (int r = 0; r < runs; r++) {
                GpuRun g = run_matmul_on_gpu(ocl, it.kernel, N, A, B, *it.C, 1, &global, &local, localBytes);
                tk.push_back(g.kernel);
                tt.push_back(g.total);
                std::fprintf(out, "%s,%d,%d,%d,%.6f,%.6f\n", it.name, N, it.local, r, g.total, g.kernel);
            }
            std::printf("%s  N=%5d  local_item_size=%3d  total median %8.4f s (min %.4f, max %.4f)  kernel %8.4f s  "
                        "%7.2f GFLOP/s  sampled rel. error %.2e\n",
                        it.name, N, it.local, median(tt), *std::min_element(tt.begin(), tt.end()),
                        *std::max_element(tt.begin(), tt.end()), median(tk), gflop / median(tk),
                        sampled_error(N, A, B, *it.C));
            std::fflush(stdout);
            std::fflush(out);
        }
        std::printf("N=%d: kernel_A vs kernel_B max rel. difference %.2e\n\n", N, max_rel_error(CB, CA));
    }

    std::fclose(out);
    clReleaseKernel(kA);
    clReleaseKernel(kB);
    clReleaseProgram(program);
    return 0;
}
