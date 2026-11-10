#include <stdio.h>
#include <stdlib.h>
#ifdef __APPLE__
#include <OpenCL/cl.h>
#else
#include <CL/cl.h>
#endif

#define VECTOR_SIZE 1024

// OpenCL kernel using integers
const char* saxpy_kernel =
"__kernel void saxpy_kernel(int alpha,                   \n"
"                  __global int *A,                       \n"
"                  __global int *B,                       \n"
"                  __global int *C)                       \n"
"{                                                        \n"
"    int index = get_global_id(0);                        \n"
"    C[index] = alpha * A[index] + B[index];              \n"
"}                                                        \n";

int main(void) {
    int i;
    int alpha = 2;

    // Allocate host memory with safety checks
    int* A = (int*)malloc(sizeof(int) * VECTOR_SIZE);
    int* B = (int*)malloc(sizeof(int) * VECTOR_SIZE);
    int* C = (int*)malloc(sizeof(int) * VECTOR_SIZE);

    if (A == NULL || B == NULL || C == NULL) {
        printf("Error: Host memory allocation failed!\n");
        return 1;
    }

    for (i = 0; i < VECTOR_SIZE; i++) {
        A[i] = i;
        B[i] = VECTOR_SIZE - i;
        C[i] = 0;
    }

    // Get platform with safety check
    cl_platform_id* platforms = NULL;
    cl_uint num_platforms;
    cl_int clStatus = clGetPlatformIDs(0, NULL, &num_platforms);

    platforms = (cl_platform_id*)malloc(sizeof(cl_platform_id) * num_platforms);
    if (platforms == NULL) {
        printf("Error: Platform memory allocation failed!\n");
        free(A); free(B); free(C);
        return 1;
    }
    clStatus = clGetPlatformIDs(num_platforms, platforms, NULL);

    // Get device with safety check
    cl_device_id* device_list = NULL;
    cl_uint num_devices;
    clStatus = clGetDeviceIDs(platforms[0], CL_DEVICE_TYPE_DEFAULT, 0, NULL, &num_devices);

    device_list = (cl_device_id*)malloc(sizeof(cl_device_id) * num_devices);
    if (device_list == NULL) {
        printf("Error: Device memory allocation failed!\n");
        free(A); free(B); free(C); free(platforms);
        return 1;
    }
    clStatus = clGetDeviceIDs(platforms[0], CL_DEVICE_TYPE_DEFAULT, num_devices, device_list, NULL);

    // Create context and modern command queue (fixes the deprecated warning)
    cl_context context = clCreateContext(NULL, num_devices, device_list, NULL, NULL, &clStatus);
    cl_command_queue command_queue = clCreateCommandQueueWithProperties(context, device_list[0], NULL, &clStatus);

    // Create memory buffers
    cl_mem A_clmem = clCreateBuffer(context, CL_MEM_READ_ONLY, VECTOR_SIZE * sizeof(int), NULL, &clStatus);
    cl_mem B_clmem = clCreateBuffer(context, CL_MEM_READ_ONLY, VECTOR_SIZE * sizeof(int), NULL, &clStatus);
    cl_mem C_clmem = clCreateBuffer(context, CL_MEM_WRITE_ONLY, VECTOR_SIZE * sizeof(int), NULL, &clStatus);

    // Copy buffers
    clStatus = clEnqueueWriteBuffer(command_queue, A_clmem, CL_TRUE, 0, VECTOR_SIZE * sizeof(int), A, 0, NULL, NULL);
    clStatus = clEnqueueWriteBuffer(command_queue, B_clmem, CL_TRUE, 0, VECTOR_SIZE * sizeof(int), B, 0, NULL, NULL);

    // Build program and kernel
    cl_program program = clCreateProgramWithSource(context, 1, (const char**)&saxpy_kernel, NULL, &clStatus);
    clStatus = clBuildProgram(program, 1, device_list, NULL, NULL, NULL);
    cl_kernel kernel = clCreateKernel(program, "saxpy_kernel", &clStatus);

    // Set arguments
    clStatus = clSetKernelArg(kernel, 0, sizeof(int), (void*)&alpha);
    clStatus = clSetKernelArg(kernel, 1, sizeof(cl_mem), (void*)&A_clmem);
    clStatus = clSetKernelArg(kernel, 2, sizeof(cl_mem), (void*)&B_clmem);
    clStatus = clSetKernelArg(kernel, 3, sizeof(cl_mem), (void*)&C_clmem);

    // Execute
    size_t global_size = VECTOR_SIZE;
    size_t local_size = 64;
    clStatus = clEnqueueNDRangeKernel(command_queue, kernel, 1, NULL, &global_size, &local_size, 0, NULL, NULL);

    // Read result
    clStatus = clEnqueueReadBuffer(command_queue, C_clmem, CL_TRUE, 0, VECTOR_SIZE * sizeof(int), C, 0, NULL, NULL);

    // Cleanup and wait
    clStatus = clFinish(command_queue);

    // Print first 10 results to check
    for (i = 0; i < 10; i++) {
        printf("%d * %d + %d = %d\n", alpha, A[i], B[i], C[i]);
    }

    // Free all resources safely
    clReleaseKernel(kernel);
    clReleaseProgram(program);
    clReleaseMemObject(A_clmem);
    clReleaseMemObject(B_clmem);
    clReleaseMemObject(C_clmem);
    clReleaseCommandQueue(command_queue);
    clReleaseContext(context);

    free(A);
    free(B);
    free(C);
    free(platforms);
    free(device_list);

    return 0;
}