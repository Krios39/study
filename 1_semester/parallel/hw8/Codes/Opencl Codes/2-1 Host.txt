#define _CRT_SECURE_NO_WARNINGS // Must be the very first line to disable fopen warnings
#include <iostream>
#include <stdio.h>
#include <stdlib.h>
#include <ctime>

#ifdef __APPLE__
#include <OpenCL/cl.h>
#else
#include <CL/cl.h>
#endif

using namespace std;

#define MAX_SOURCE_SIZE 100000000

int main(void) {
    clock_t startTime = clock();

    int i;
    const int LIST_SIZE = 1024;

    // Fixed pointer declarations (added missing '*')
    int* A = (int*)malloc(sizeof(int) * LIST_SIZE);
    int* B = (int*)malloc(sizeof(int) * LIST_SIZE);
    int alpha = 2;

    if (A == NULL || B == NULL) {
        printf("Error: Memory allocation failed!\n");
        return 1;
    }

    for (i = 0; i < LIST_SIZE; i++) {
        A[i] = i;
        B[i] = 100;
    }

    // Load the kernel source code (Fixed FILE* and char* declarations)
    FILE* fp;
    char* source_str;
    size_t source_size;

    fp = fopen("vector_add_kernel.cl", "r");
    if (!fp) {
        fprintf(stderr, "Failed to load kernel.\n");
        exit(1);
    }

    source_str = (char*)malloc(MAX_SOURCE_SIZE);
    if (!source_str) {
        fprintf(stderr, "Failed to allocate memory for source.\n");
        fclose(fp);
        exit(1);
    }

    source_size = fread(source_str, 1, MAX_SOURCE_SIZE, fp);
    fclose(fp);

    // Get platform and device information
    cl_platform_id platform_id = NULL;
    cl_device_id device_id = NULL;
    cl_uint ret_num_devices;
    cl_uint ret_num_platforms;
    cl_int ret = clGetPlatformIDs(1, &platform_id, &ret_num_platforms);
    ret = clGetDeviceIDs(platform_id, CL_DEVICE_TYPE_GPU, 1, &device_id, &ret_num_devices);

    // Create an OpenCL context
    cl_context context = clCreateContext(NULL, 1, &device_id, NULL, NULL, &ret);

    // Create a modern command queue (fixes the deprecated warning)
    cl_command_queue command_queue = clCreateCommandQueueWithProperties(context, device_id, NULL, &ret);

    // Create memory buffers on the device for each vector 
    cl_mem a_mem_obj = clCreateBuffer(context, CL_MEM_READ_ONLY, LIST_SIZE * sizeof(int), NULL, &ret);
    cl_mem b_mem_obj = clCreateBuffer(context, CL_MEM_READ_ONLY, LIST_SIZE * sizeof(int), NULL, &ret);
    cl_mem c_mem_obj = clCreateBuffer(context, CL_MEM_WRITE_ONLY, LIST_SIZE * sizeof(int), NULL, &ret);

    // Copy the lists A and B to their respective memory buffers
    ret = clEnqueueWriteBuffer(command_queue, a_mem_obj, CL_TRUE, 0, LIST_SIZE * sizeof(int), A, 0, NULL, NULL);
    ret = clEnqueueWriteBuffer(command_queue, b_mem_obj, CL_TRUE, 0, LIST_SIZE * sizeof(int), B, 0, NULL, NULL);

    // Create a program from the kernel source
    cl_program program = clCreateProgramWithSource(context, 1, (const char**)&source_str, (const size_t*)&source_size, &ret);

    // Build the program
    ret = clBuildProgram(program, 1, &device_id, NULL, NULL, NULL);
    cout << "Error is  = " << ret << endl;

    // Create the OpenCL kernel
    cl_kernel kernel = clCreateKernel(program, "vector_add_kernel", &ret);

    // Set the arguments of the kernel (Make sure your .cl kernel matches these arguments!)
    ret = clSetKernelArg(kernel, 0, sizeof(int), (void*)&alpha);
    ret = clSetKernelArg(kernel, 1, sizeof(cl_mem), (void*)&a_mem_obj);
    ret = clSetKernelArg(kernel, 2, sizeof(cl_mem), (void*)&b_mem_obj);
    ret = clSetKernelArg(kernel, 3, sizeof(cl_mem), (void*)&c_mem_obj);

    // Execute the OpenCL kernel on the list
    size_t global_item_size = LIST_SIZE; // Process the entire lists
    size_t local_item_size = 64; // Process in groups of 64
    ret = clEnqueueNDRangeKernel(command_queue, kernel, 1, NULL, &global_item_size, &local_item_size, 0, NULL, NULL);

    clock_t endTime = clock();

    // Read the memory buffer C on the device to the local variable C (Fixed missing '*')
    int* C = (int*)malloc(sizeof(int) * LIST_SIZE);
    if (C == NULL) {
        printf("Error: Memory allocation for C failed!\n");
        return 1;
    }

    ret = clEnqueueReadBuffer(command_queue, c_mem_obj, CL_TRUE, 0, LIST_SIZE * sizeof(int), C, 0, NULL, NULL);

    // Display the result to the screen
    for (i = 0; i < 1000; i++) // showing first 10 for quick check
        printf("%d * %d + %d = %d\n", alpha, A[i], B[i], C[i]);

    printf("OpenCL Clock Time = %f seconds ", (float)(endTime - startTime) / CLOCKS_PER_SEC);
    cout << endl;

    // Clean up
    ret = clFlush(command_queue);
    ret = clFinish(command_queue);
    ret = clReleaseKernel(kernel);
    ret = clReleaseProgram(program);
    ret = clReleaseMemObject(a_mem_obj);
    ret = clReleaseMemObject(b_mem_obj);
    ret = clReleaseMemObject(c_mem_obj);
    ret = clReleaseCommandQueue(command_queue);
    ret = clReleaseContext(context);

    free(A);
    free(B);
    free(C);
    free(source_str);

    system("pause");
    return 0;
}