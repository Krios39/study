#pragma once
#define CL_TARGET_OPENCL_VERSION 300
#include <CL/cl.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <random>
#include <sstream>
#include <string>
#include <vector>

#define CL_CHECK(expr)                                                                   \
    do {                                                                                 \
        cl_int err__ = (expr);                                                           \
        if (err__ != CL_SUCCESS) {                                                       \
            std::fprintf(stderr, "OpenCL error %d at %s:%d: %s\n", err__, __FILE__,      \
                         __LINE__, #expr);                                               \
            std::exit(1);                                                                \
        }                                                                                \
    } while (0)

inline double now_s()
{
    using clock = std::chrono::steady_clock;
    return std::chrono::duration<double>(clock::now().time_since_epoch()).count();
}

inline double median(std::vector<double> v)
{
    std::sort(v.begin(), v.end());
    size_t n = v.size();
    return n % 2 ? v[n / 2] : 0.5 * (v[n / 2 - 1] + v[n / 2]);
}

inline std::vector<float> random_matrix(int N, unsigned seed)
{
    std::mt19937 gen(seed);
    std::uniform_real_distribution<float> dist(0.0f, 1.0f);
    std::vector<float> M(static_cast<size_t>(N) * N);
    for (auto& v : M) v = dist(gen);
    return M;
}

inline double max_rel_error(const std::vector<float>& X, const std::vector<float>& Ref)
{
    double maxRef = 0.0, maxDiff = 0.0;
    for (size_t i = 0; i < Ref.size(); i++) {
        maxRef = std::max(maxRef, std::fabs(static_cast<double>(Ref[i])));
        maxDiff = std::max(maxDiff, std::fabs(static_cast<double>(X[i]) - Ref[i]));
    }
    return maxRef > 0 ? maxDiff / maxRef : maxDiff;
}

inline std::string device_string(cl_device_id d, cl_device_info info)
{
    size_t n = 0;
    clGetDeviceInfo(d, info, 0, nullptr, &n);
    std::string s(n, '\0');
    clGetDeviceInfo(d, info, n, s.data(), nullptr);
    while (!s.empty() && s.back() == '\0') s.pop_back();
    return s;
}

struct OclContext {
    cl_platform_id platform = nullptr;
    cl_device_id device = nullptr;
    cl_context context = nullptr;
    cl_command_queue queue = nullptr;
    size_t maxWorkGroup = 0;

    OclContext()
    {
        cl_uint np = 0;
        CL_CHECK(clGetPlatformIDs(0, nullptr, &np));
        std::vector<cl_platform_id> platforms(np);
        CL_CHECK(clGetPlatformIDs(np, platforms.data(), nullptr));
        for (auto p : platforms) {
            cl_uint nd = 0;
            if (clGetDeviceIDs(p, CL_DEVICE_TYPE_GPU, 1, &device, &nd) == CL_SUCCESS && nd > 0) {
                platform = p;
                break;
            }
        }
        if (!platform) {
            std::fprintf(stderr, "No OpenCL GPU device found.\n");
            std::exit(1);
        }
        cl_int err;
        context = clCreateContext(nullptr, 1, &device, nullptr, nullptr, &err);
        CL_CHECK(err);
        cl_queue_properties props[] = {CL_QUEUE_PROPERTIES, CL_QUEUE_PROFILING_ENABLE, 0};
        queue = clCreateCommandQueueWithProperties(context, device, props, &err);
        CL_CHECK(err);
        CL_CHECK(clGetDeviceInfo(device, CL_DEVICE_MAX_WORK_GROUP_SIZE, sizeof(maxWorkGroup), &maxWorkGroup, nullptr));
    }

    ~OclContext()
    {
        clReleaseCommandQueue(queue);
        clReleaseContext(context);
    }

    void print_info() const
    {
        cl_uint units = 0;
        cl_ulong mem = 0, local = 0;
        clGetDeviceInfo(device, CL_DEVICE_MAX_COMPUTE_UNITS, sizeof(units), &units, nullptr);
        clGetDeviceInfo(device, CL_DEVICE_GLOBAL_MEM_SIZE, sizeof(mem), &mem, nullptr);
        clGetDeviceInfo(device, CL_DEVICE_LOCAL_MEM_SIZE, sizeof(local), &local, nullptr);
        std::printf("OpenCL device : %s\n", device_string(device, CL_DEVICE_NAME).c_str());
        std::printf("Version       : %s, driver %s\n", device_string(device, CL_DEVICE_VERSION).c_str(),
                    device_string(device, CL_DRIVER_VERSION).c_str());
        std::printf("Compute units : %u, max work-group size %zu, local memory %llu KB, global memory %llu MB\n",
                    units, maxWorkGroup, static_cast<unsigned long long>(local / 1024),
                    static_cast<unsigned long long>(mem / (1024 * 1024)));
    }

    cl_program build(const std::string& path, const std::string& options) const
    {
        std::ifstream f(path);
        if (!f) {
            std::fprintf(stderr, "Cannot open kernel file %s\n", path.c_str());
            std::exit(1);
        }
        std::stringstream ss;
        ss << f.rdbuf();
        std::string src = ss.str();
        const char* s = src.c_str();
        size_t len = src.size();
        cl_int err;
        cl_program program = clCreateProgramWithSource(context, 1, &s, &len, &err);
        CL_CHECK(err);
        if (clBuildProgram(program, 1, &device, options.c_str(), nullptr, nullptr) != CL_SUCCESS) {
            size_t n = 0;
            clGetProgramBuildInfo(program, device, CL_PROGRAM_BUILD_LOG, 0, nullptr, &n);
            std::string log(n, '\0');
            clGetProgramBuildInfo(program, device, CL_PROGRAM_BUILD_LOG, n, log.data(), nullptr);
            std::fprintf(stderr, "Build failed:\n%s\n", log.c_str());
            std::exit(1);
        }
        return program;
    }
};

inline double event_seconds(cl_event e)
{
    cl_ulong start = 0, end = 0;
    CL_CHECK(clGetEventProfilingInfo(e, CL_PROFILING_COMMAND_START, sizeof(start), &start, nullptr));
    CL_CHECK(clGetEventProfilingInfo(e, CL_PROFILING_COMMAND_END, sizeof(end), &end, nullptr));
    return (end - start) * 1e-9;
}

struct GpuRun {
    double kernel = 0;
    double total = 0;
};

inline GpuRun run_matmul_on_gpu(const OclContext& ocl, cl_kernel kernel, int N, const std::vector<float>& A,
                                const std::vector<float>& B, std::vector<float>& C, cl_uint dims,
                                const size_t* global, const size_t* local, size_t localBytes)
{
    size_t bytes = static_cast<size_t>(N) * N * sizeof(float);
    cl_int err;
    double t0 = now_s();
    cl_mem dA = clCreateBuffer(ocl.context, CL_MEM_READ_ONLY, bytes, nullptr, &err);
    CL_CHECK(err);
    cl_mem dB = clCreateBuffer(ocl.context, CL_MEM_READ_ONLY, bytes, nullptr, &err);
    CL_CHECK(err);
    cl_mem dC = clCreateBuffer(ocl.context, CL_MEM_WRITE_ONLY, bytes, nullptr, &err);
    CL_CHECK(err);
    CL_CHECK(clEnqueueWriteBuffer(ocl.queue, dA, CL_TRUE, 0, bytes, A.data(), 0, nullptr, nullptr));
    CL_CHECK(clEnqueueWriteBuffer(ocl.queue, dB, CL_TRUE, 0, bytes, B.data(), 0, nullptr, nullptr));

    CL_CHECK(clSetKernelArg(kernel, 0, sizeof(int), &N));
    CL_CHECK(clSetKernelArg(kernel, 1, sizeof(cl_mem), &dA));
    CL_CHECK(clSetKernelArg(kernel, 2, sizeof(cl_mem), &dB));
    CL_CHECK(clSetKernelArg(kernel, 3, sizeof(cl_mem), &dC));
    if (localBytes > 0) CL_CHECK(clSetKernelArg(kernel, 4, localBytes, nullptr));

    cl_event ev;
    CL_CHECK(clEnqueueNDRangeKernel(ocl.queue, kernel, dims, nullptr, global, local, 0, nullptr, &ev));
    CL_CHECK(clEnqueueReadBuffer(ocl.queue, dC, CL_TRUE, 0, bytes, C.data(), 1, &ev, nullptr));
    double t1 = now_s();

    GpuRun r;
    r.kernel = event_seconds(ev);
    r.total = t1 - t0;
    clReleaseEvent(ev);
    clReleaseMemObject(dA);
    clReleaseMemObject(dB);
    clReleaseMemObject(dC);
    return r;
}
