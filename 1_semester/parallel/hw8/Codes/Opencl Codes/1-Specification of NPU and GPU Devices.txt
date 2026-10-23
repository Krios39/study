
#define _CRT_SECURE_NO_WARNINGS
#include <iostream>
#include <vector>
#include <string>
#include <iomanip>
#include <CL/cl.h>

using namespace std;

string getPlatformString(cl_platform_id platform, cl_platform_info info)
{
    size_t size = 0;
    clGetPlatformInfo(platform, info, 0, nullptr, &size);

    if (size == 0) return "Unknown";

    vector<char> buffer(size);
    clGetPlatformInfo(platform, info, size, buffer.data(), nullptr);

    return string(buffer.data());
}

string getDeviceString(cl_device_id device, cl_device_info info)
{
    size_t size = 0;
    clGetDeviceInfo(device, info, 0, nullptr, &size);

    if (size == 0) return "Unknown";

    vector<char> buffer(size);
    clGetDeviceInfo(device, info, size, buffer.data(), nullptr);

    return string(buffer.data());
}

void printDeviceInfo(cl_device_id device)
{
    cl_device_type type;
    cl_uint computeUnits = 0;
    cl_uint clockMHz = 0;
    cl_uint addressBits = 0;
    cl_uint maxDimensions = 0;
    cl_uint maxWorkGroup = 0;
    cl_ulong globalMemory = 0;
    cl_ulong maxAllocation = 0;
    cl_ulong localMemory = 0;
    size_t maxWorkItemSizes[3] = { 0, 0, 0 };

    clGetDeviceInfo(device, CL_DEVICE_TYPE,
        sizeof(type), &type, nullptr);

    cout << "\nDevice name: "
        << getDeviceString(device, CL_DEVICE_NAME) << '\n';

    cout << "Vendor: "
        << getDeviceString(device, CL_DEVICE_VENDOR) << '\n';

    cout << "Device version: "
        << getDeviceString(device, CL_DEVICE_VERSION) << '\n';

    cout << "OpenCL C version: "
        << getDeviceString(device, CL_DEVICE_OPENCL_C_VERSION) << '\n';

    cout << "Driver version: "
        << getDeviceString(device, CL_DRIVER_VERSION) << '\n';

    cout << "Device type: ";

    if (type & CL_DEVICE_TYPE_GPU) cout << "GPU";
    else if (type & CL_DEVICE_TYPE_CPU) cout << "CPU";
    else if (type & CL_DEVICE_TYPE_ACCELERATOR) cout << "Accelerator";
    else cout << "Other";

    cout << '\n';

    clGetDeviceInfo(device, CL_DEVICE_MAX_COMPUTE_UNITS,
        sizeof(computeUnits), &computeUnits, nullptr);

    clGetDeviceInfo(device, CL_DEVICE_MAX_CLOCK_FREQUENCY,
        sizeof(clockMHz), &clockMHz, nullptr);

    clGetDeviceInfo(device, CL_DEVICE_ADDRESS_BITS,
        sizeof(addressBits), &addressBits, nullptr);

    clGetDeviceInfo(device, CL_DEVICE_GLOBAL_MEM_SIZE,
        sizeof(globalMemory), &globalMemory, nullptr);

    clGetDeviceInfo(device, CL_DEVICE_MAX_MEM_ALLOC_SIZE,
        sizeof(maxAllocation), &maxAllocation, nullptr);

    clGetDeviceInfo(device, CL_DEVICE_LOCAL_MEM_SIZE,
        sizeof(localMemory), &localMemory, nullptr);

    clGetDeviceInfo(device, CL_DEVICE_MAX_WORK_ITEM_DIMENSIONS,
        sizeof(maxDimensions), &maxDimensions, nullptr);

    clGetDeviceInfo(device, CL_DEVICE_MAX_WORK_GROUP_SIZE,
        sizeof(maxWorkGroup), &maxWorkGroup, nullptr);

    clGetDeviceInfo(device, CL_DEVICE_MAX_WORK_ITEM_SIZES,
        sizeof(maxWorkItemSizes), maxWorkItemSizes, nullptr);

    cout << "Compute units: " << computeUnits << '\n';
    cout << "Maximum clock frequency: " << clockMHz << " MHz\n";
    cout << "Address width: " << addressBits << " bits\n";

    cout << fixed << setprecision(2);
    cout << "Global device memory: "
        << (double)globalMemory / (1024.0 * 1024.0)
        << " MB\n";

    cout << "Maximum single memory allocation: "
        << (double)maxAllocation / (1024.0 * 1024.0)
        << " MB\n";

    cout << "Local memory: "
        << (double)localMemory / 1024.0 << " KB\n";

    cout << "Maximum work-group size: "
        << maxWorkGroup << '\n';

    cout << "Maximum work-item dimensions: "
        << maxDimensions << '\n';

    cout << "Maximum work-item sizes: ";

    for (cl_uint i = 0; i < 3 && i < maxDimensions; i++)
        cout << maxWorkItemSizes[i] << ' ';

    cout << "\n";
}

int main()
{
    cl_uint platformCount = 0;

    cl_int err = clGetPlatformIDs(0, nullptr, &platformCount);

    cout << "====================================\n";
    cout << "      OPENCL SYSTEM INFORMATION\n";
    cout << "====================================\n";

    if (err != CL_SUCCESS || platformCount == 0)
    {
        cout << "No OpenCL platforms found.\n";
        cout << "Check your graphics driver and OpenCL runtime.\n";
        return 1;
    }

    vector<cl_platform_id> platforms(platformCount);

    err = clGetPlatformIDs(platformCount, platforms.data(), nullptr);

    if (err != CL_SUCCESS)
    {
        cout << "Failed to retrieve OpenCL platforms: "
            << err << '\n';
        return 1;
    }

    cout << "Number of OpenCL platforms: "
        << platformCount << "\n";

    for (cl_uint p = 0; p < platformCount; p++)
    {
        cout << "\n====================================\n";
        cout << "PLATFORM " << p + 1 << '\n';
        cout << "====================================\n";

        cout << "Platform name: "
            << getPlatformString(platforms[p], CL_PLATFORM_NAME) << '\n';

        cout << "Platform vendor: "
            << getPlatformString(platforms[p], CL_PLATFORM_VENDOR) << '\n';

        cout << "Platform version: "
            << getPlatformString(platforms[p], CL_PLATFORM_VERSION) << '\n';

        cout << "Platform profile: "
            << getPlatformString(platforms[p], CL_PLATFORM_PROFILE) << '\n';

        cl_uint deviceCount = 0;

        err = clGetDeviceIDs(platforms[p], CL_DEVICE_TYPE_ALL,
            0, nullptr, &deviceCount);

        if (err != CL_SUCCESS || deviceCount == 0)
        {
            cout << "No OpenCL devices available on this platform.\n";
            continue;
        }

        vector<cl_device_id> devices(deviceCount);

        err = clGetDeviceIDs(platforms[p], CL_DEVICE_TYPE_ALL,
            deviceCount, devices.data(), nullptr);

        if (err != CL_SUCCESS)
        {
            cout << "Failed to retrieve devices: " << err << '\n';
            continue;
        }

        cout << "Number of devices: " << deviceCount << '\n';

        for (cl_uint d = 0; d < deviceCount; d++)
        {
            cout << "\n------------------------------------\n";
            cout << "DEVICE " << d + 1 << '\n';
            cout << "------------------------------------\n";

            printDeviceInfo(devices[d]);
        }
    }

    cout << "\n====================================\n";
    cout << "Information collection completed.\n";

    return 0;
}
