#include <iostream>
#include <vector>
#include <CL/cl.h>

int main() {
    cl_uint platformCount = 0;
    clGetPlatformIDs(0, NULL, &platformCount);

    if (platformCount == 0) {
        std::cout << "No OpenCL platforms found." << std::endl;
        return 0;
    }

    std::vector<cl_platform_id> platforms(platformCount);
    clGetPlatformIDs(platformCount, platforms.data(), NULL);

    std::cout << "Success! Found " << platformCount << " OpenCL platform(s):\n";
    for (cl_uint i = 0; i < platformCount; ++i) {
        char name[128];
        clGetPlatformInfo(platforms[i], CL_PLATFORM_NAME, 128, name, NULL);
        std::cout << " - " << name << std::endl;
    }

    return 0;
}