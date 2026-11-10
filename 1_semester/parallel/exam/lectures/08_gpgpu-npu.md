# Лекция 08: General-Purpose GPU and NPU Programming

Слайды: gpgpu-npu-guest.pdf

Гостевая лекция Mohammad Anagreh. Примеры кода лежат в `code/Codes/` (OpenCL Codes, NPU Codes).
Структура лекции: **Section 1:** GPU / GPGPU, CUDA, OpenCL, фреймворки. **Section 2:** NPU. **Section 3:** архитектура и программирование OpenCL.

---

## 1. GPGPU

**Определение.** *A general-purpose GPU (GPGPU) is a GPU that performs non-specialized calculations, which are tasks typically conducted by the CPU.*

Задачи, которые переносят с CPU на GPU: physics calculations, encryption/decryption, scientific computations, cryptocurrencies (Bitcoin), image processing.

### CPU vs GPU
| | CPU | GPU |
|---|---|---|
| Ядра | **few cores**, оптимизированы для serial processing (или ограниченного параллелизма) | **thousands of smaller, more efficient cores** |
| Clock speed | выше, поэтому быстрее на **одиночных вычислениях** | ниже, но много вычислений одновременно |
| Где лучше | **small-scale iterative** algorithms | **large-scale parallel** computing iterations |

- Комбинация CPU + GPU даёт лучшую производительность.
- Программа состоит из двух частей:
  - **Host code**: последовательная часть, выполняется на CPU;
  - **Kernel code**: параллельная часть, выполняется на GPU.

---

## 2. CUDA

- **CUDA** — parallel computing platform and programming model от **NVIDIA** для вычислений общего назначения на GPU.
- Работает на Windows, Linux, macOS, но **только на NVIDIA hardware**. OpenCL работает почти на любой ОС и большинстве видов железа.
- **Typical program structure:**
  ```c
  void function(...) {
      // Allocate memory on the GPU
      // Transfer input data to the GPU
      // Launch kernel on the GPU
      // Transfer output data to CPU
  }
  __global__ void kernel(...) { /* code executed on the GPU */ }
  ```

---

## 3. OpenCL

- **OpenCL (Open Computing Language)** — framework для программ, которые выполняются параллельно на разных compute devices (CPU, GPU…) от разных вендоров (AMD, Intel, ATI, Nvidia…).
- Две части: **Host code** (общая структура программы, вызов kernel) и **Kernel code**. OpenCL задаёт язык для kernels, то есть функций, выполняемых на устройствах.
- Нужны **свежие драйверы** видеокарты с поддержкой OpenCL, иначе OpenCL работать не будет.

### OpenCL Features
- Стандарт поддерживает **Khronos Group** (на слайде версии 1.0, 1.1, 1.2).
- Основные сторонники: **Apple, AMD, Intel**.
- Альтернатива CUDA, рассчитан на **"heterogeneous computing"**.
- Работает на **CPUs, GPUs, DSPs, FPGAs**.
- Структура host program + kernels такая же, как в CUDA.
- **Ограничения kernel-языка:**
  - **no recursion, no variadic functions, no function pointers**;
  - **cannot dynamically allocate memory from device** (нет `malloc` внутри kernel).
- OpenCL working group: AMD, ARM, Intel, NVIDIA, IBM, Samsung, Nokia, Apple, TI, EA, Activision Blizzard и др.

### CUDA vs OpenCL
| Критерий | CUDA | OpenCL |
|---|---|---|
| Performance | не определена заранее: зависит от качества кода, железа и т.д. | то же самое |
| Vendor implementation | **only NVIDIA** | **TONS of vendors** (AMD, NVIDIA, Intel, Apple…) |
| Portability | только NVIDIA hardware | переносим, если не использовать vendor-specific extensions |
| Open-source vs commercial | **proprietary** NVIDIA | **open standard** |
| OS support | все основные ОС, но нужен NVIDIA GPU | разные ОС |
| Libraries | **extensive** high-performance libraries | много библиотек для любого OpenCL-compliant железа, но меньше, чем у CUDA |
| Community | **larger** | растёт, но меньше |

### Terminology: CUDA → OpenCL
| CUDA | OpenCL |
|---|---|
| Host Memory | Host Memory |
| Global/Device Memory | Global Memory |
| Local Memory | Global Memory |
| Constant Memory | Constant Memory |
| **Shared Memory** | **Local Memory** |
| **Registers** | **Private Memory** |
| **Grid** | **NDRange** |
| **Block** | **Work group** |
| **Thread** | **Work item** |
| Thread ID | Global ID |
| Block Index | Block ID (group ID) |
| Thread Index | Local ID |

Ловушка: «local memory» в CUDA и в OpenCL — **разные вещи**. Local в OpenCL = shared в CUDA (общая на work-group). CUDA local memory — это приватные данные потока, которые физически лежат в global memory.

---

## 4. Modern GPU Programming Models

| Framework | Developer | Language | Key advantage |
|---|---|---|---|
| **oneAPI** | Intel | C++, DPC++ | unified programming for CPU, GPU, FPGA |
| **SYCL** | Khronos Group | C++ | portable **single-source** GPU programming |
| **HIP** | AMD | C++ (CUDA-like) | runs on **AMD and NVIDIA** GPUs |
| **Numba** | Anaconda | Python | **JIT** compile Python code for GPU |
| **Triton** | OpenAI | Python | easy custom GPU kernels for deep learning |

- CUDA по-прежнему лидирует по производительности на NVIDIA.
- SYCL и oneAPI быстро растут как открытые кросс-платформенные решения.
- Python-инструменты (Numba, Triton) упрощают работу с GPU в AI и науке.

### PyTorch vs low-level frameworks
| Feature | PyTorch | CUDA / OpenCL / SYCL / oneAPI |
|---|---|---|
| Programming level | high-level (Python API) | low-level (C/C++ kernels) |
| Main use | deep learning & AI training | general-purpose GPU computation |
| GPU control | automatic | manual (developer writes kernels) |
| Ease of use | very easy | complex, нужна экспертиза |
| Performance tuning | automated (cuDNN, TorchScript, Triton) | fully manual |
| Supported GPUs | NVIDIA (CUDA), AMD (ROCm/HIP) | varies (NVIDIA, AMD, Intel…) |
| Example | `x = torch.matmul(a, b)` | kernel + host code |

**Стек уровней:**
- **High-level:** PyTorch, TensorFlow, JAX
- **Mid-level:** cuDNN, ROCm, Triton
- **Low-level:** OpenCL, CUDA, SYCL, oneAPI

---

## 5. NPU (Neural Processing Unit)

- **NPU** — специализированный процессор, созданный **исключительно для AI / machine learning**.
- **GPU** — универсальный параллельный исполнитель: «built to do many things at the same time», изначально для игр, хорош для любой математики и графики.
- **NPU** — «designed to mimic how the human brain works», быстрый и энергоэффективный на voice recognition, image generation и подобных задачах.
- **Key benefit:** GPU — мощный generalist, NPU — specialist для AI, расходует **меньше энергии и батареи**.

### CPU vs GPU vs NPU execution models
| | CPU (The Brain) | GPU (Massive SIMD) | NPU (Spatial Tensor) |
|---|---|---|---|
| Primary role | general-purpose logic & control | heavy parallel math & graphics | dedicated AI & neural workloads |
| Особенности | Jack of all trades: ОС, пошаговая логика; fast serial execution; limited parallel power | massive parallelism (тысячи операций одновременно); **high power draw**; low-level control через OpenCL/CUDA | purpose-built для матричной математики нейросетей; **ultra-low power** (фоновый AI); target для фреймворков вроде **OpenVINO** |

### Energy Efficiency & AI Performance Metrics
| Metric | Host CPU | iGPU | Dedicated NPU |
|---|---|---|---|
| Peak compute (INT8) | 5–15 TOPS | 20–50 TOPS | **45–120+ TOPS** |
| Typical power draw | 28–65 W | 15–45 W | **2–10 W** |
| Energy efficiency | ~0.3 TOPS/W | ~1.2 TOPS/W | **8.0+ TOPS/W** |
| Memory access model | L3 Cache → DRAM | Shared System RAM | **Direct Local SRAM** |
| Optimal target tasks | Sequential Logic | Batch Image/Video | **Continuous Local AI** |

- **TOPS** (Tera Operations Per Second) — триллионы операций в секунду, то есть скорость.
- **W** (Watts) — потребляемая мощность.
- **TOPS/W** — сколько работы делается на 1 Вт. **Чем выше, тем энергоэффективнее.**

### GPU vs NPU in heterogeneous computing
- **GPU:** general parallel computing, physics, graphics, custom math kernels. Программируется **OpenCL / CUDA**.
- **NPU:** **AI inference** (image recognition, voice processing, deep learning). Программируется AI-фреймворками, например **Intel OpenVINO**.
- **Modern trend:** heterogeneous systems объединяют **CPU + GPU + NPU** и запускают каждую нагрузку на подходящем железе.

### OpenVINO: работа с NPU
В отличие от OpenCL (свой kernel + ручное управление buffers), OpenVINO позволяет обратиться к NPU в несколько строк:
```cpp
ov::Core core;                                                     // Initialize OpenVINO
std::string full_name = core.get_property("NPU", ov::device::full_name);
std::cout << "Success! Connected to: " << full_name << std::endl;
// Output: Success! Connected to: Intel(R) AI Boost
```
**Сложение векторов на NPU** (`NPU Codes/1-Adding two vectors.txt`). Вычисление описывается **графом операций (model)**, а не kernel'ом:
1. `ov::op::v0::Parameter(ov::element::f32, ov::Shape{1024})` ×2: входные параметры.
2. `ov::op::v1::Add(param1, param2)`: узел-операция графа.
3. `ov::Model(OutputVector{add_node}, ParameterVector{param1, param2}, "vector_add_model")`.
4. `core.compile_model(model, "NPU")`: компиляция **под NPU**.
5. `compiled_model.create_infer_request()`.
6. Заполнить `ov::Tensor` и вызвать `infer_request.set_input_tensor(i, tensor)`.
7. `infer_request.infer()`: запуск на NPU.
8. `infer_request.get_output_tensor()` → `data<float>()`.

Если драйверы NPU не установлены, бросается исключение (в коде есть подсказка «Make sure your Intel NPU drivers are fully updated!»). NPU **может не отображаться через OpenCL** (комментарий в scanner-коде: «an NPU may not be exposed through OpenCL»).

---

## 6. Архитектура OpenCL

### NDRange, work-groups, work-items, wavefronts
- **NDRange** задаёт **число work-items** на compute device (1D/2D/3D index space).
- **Work-items** делятся на **work-groups**.
- **Work-group** делится на **wavefronts** (аппаратная единица AMD, размер зависит от железа; у NVIDIA аналог — warp).
- **Wavefront** — группа work-items, которые выполняются вместе.

### Thread structure (built-in функции kernel)
| Function | Description |
|---|---|
| `uint get_work_dim()` | число измерений |
| `get_global_id(dim)` | ID текущего work-item, $[0, WI)$ |
| `get_global_size(dim)` | общее число work-items (WI) |
| `get_global_offset(dim)` | offset, заданный в `clEnqueueNDRangeKernel` |
| `get_group_id(dim)` | ID текущей work-group, $[0, WG)$ |
| `get_local_id(dim)` | ID work-item внутри группы, $[0, WI/WG)$ |
| `get_local_size(dim)` | work-items в группе $= WI/WG$ |
| `get_num_groups(dim)` | число work-groups (WG) |

Связи: `global_size = num_groups * local_size`. Без offset: `global_id = group_id * local_size + local_id`.

### Memory model
```
Host:   Host Memory
          ↕
Device: Global/Constant Memory      (все work-items)
          ↕
        Local Memory                (одна work-group)
          ↕
        Private Memory              (один work-item)
```
- **Buffer object** — блок памяти, выделенный OpenCL-программой; обычно хранит входные и выходные данные work-items.
- **Global memory** — часть памяти устройства, **любой work-item может читать и писать любое место**. Объём узнают через `clGetDeviceInfo()` (`CL_DEVICE_GLOBAL_MEM_SIZE`).
- **Constant memory** — часть памяти устройства, **read-only**.
- **Local memory** — доступна **всем work-items одной work-group**.
- **Private memory** — доступна **только одному work-item**. Квалификатор **`__private`**.
- **Host memory** — память хоста (обычно основная RAM компьютера).

### Synchronization
- Синхронизация часто означает **serialization**: поток ждёт другой поток или завершения процедуры.
- **Два типа:**
  1. among **work-items** within a **work-group**;
  2. among **command queues** within a **context**.
- **Barrier**: work-item ждёт, пока **все work-items группы** дойдут до того же барьера, затем все продолжают.
  - `work_group_barrier();` — все work-items группы должны выполнить его, прежде чем кто-либо продолжит.
  - `barrier(CLK_LOCAL_MEM_FENCE);` — флаги `CLK_GLOBAL_MEM_FENCE` (global memory) и `CLK_LOCAL_MEM_FENCE` (local memory).
  - Барьер работает **только внутри work-group**. Глобальную синхронизацию получают, разбивая работу на несколько kernel-запусков.

---

## 7. Программирование OpenCL: компоненты

- **Context**: связывает устройства (GPU, CPU) и память.
- **Program**: содержит kernels и компилирует код под разные устройства.
- **Kernel**: функция, выполняемая на устройстве (обычно GPU, но может и CPU).
- **Command Queue**: управляет выполнением задач и передачей данных CPU↔device.
- **Buffer**: данные для kernel или для передачи host↔device.
- **Write to Buffer**: передача аргументов в Global Memory устройства.
- **Execute Kernel**: постановка параллельного выполнения в очередь.
- **Read from Buffer**: получение результата обратно на HOST.

Установка: NVIDIA → **CUDA Toolkit**, AMD → **AMD APP SDK**, Intel → **Intel OpenCL SDK**, macOS → OpenCL от Apple уже установлен.

## 8. Host program: шаги (vector add)

Host program управляет выполнением kernels. Пишется на C, есть bindings для C++ и Python.

```c
// 1. Platform (NVIDIA, AMD, Intel)
cl_int ret = clGetPlatformIDs(1, &platform_id, &ret_num_platforms);
// 2. Device (GPU/CPU)
ret = clGetDeviceIDs(platform_id, CL_DEVICE_TYPE_DEFAULT, 1, &device_id, &ret_num_devices);
// 3. Context
cl_context context = clCreateContext(NULL, 1, &device_id, NULL, NULL, &ret);
// 4. Command queue  (в новых версиях: clCreateCommandQueueWithProperties(context, device_id, NULL, &ret))
cl_command_queue command_queue = clCreateCommandQueue(context, device_id, 0, &ret);
// 5. Buffers
cl_mem a_mem_obj = clCreateBuffer(context, CL_MEM_READ_ONLY,  LIST_SIZE*sizeof(int), NULL, &ret);
cl_mem b_mem_obj = clCreateBuffer(context, CL_MEM_READ_ONLY,  LIST_SIZE*sizeof(int), NULL, &ret);
cl_mem c_mem_obj = clCreateBuffer(context, CL_MEM_WRITE_ONLY, LIST_SIZE*sizeof(int), NULL, &ret);
// 6. Host → device
ret = clEnqueueWriteBuffer(command_queue, a_mem_obj, CL_TRUE, 0, LIST_SIZE*sizeof(int), A, 0, NULL, NULL);
ret = clEnqueueWriteBuffer(command_queue, b_mem_obj, CL_TRUE, 0, LIST_SIZE*sizeof(int), B, 0, NULL, NULL);
// 7. Program from source (source читается из файла "vector_add_kernel.cl" через fopen/fread)
cl_program program = clCreateProgramWithSource(context, 1, (const char**)&source_str, (const size_t*)&source_size, &ret);
// 8. Build (online — компиляция во время выполнения; offline — заранее скомпилированный)
ret = clBuildProgram(program, 1, &device_id, NULL, NULL, NULL);
// 9. Kernel object (имя = имя __kernel функции)
cl_kernel kernel = clCreateKernel(program, "vector_add", &ret);
// 10. Arguments (индекс = позиция параметра)
ret = clSetKernelArg(kernel, 0, sizeof(cl_mem), (void*)&a_mem_obj);
ret = clSetKernelArg(kernel, 1, sizeof(cl_mem), (void*)&b_mem_obj);
ret = clSetKernelArg(kernel, 2, sizeof(cl_mem), (void*)&c_mem_obj);
// 11. Execute: work_dim=1, offset=NULL, global, local
size_t global_item_size = LIST_SIZE, local_item_size = 64;
ret = clEnqueueNDRangeKernel(command_queue, kernel, 1, NULL, &global_item_size, &local_item_size, 0, NULL, NULL);
// 12. Device → host
ret = clEnqueueReadBuffer(command_queue, c_mem_obj, CL_TRUE, 0, LIST_SIZE*sizeof(int), C, 0, NULL, NULL);
// 13. Cleanup
clFlush(command_queue); clFinish(command_queue);
clReleaseKernel(kernel); clReleaseProgram(program);
clReleaseMemObject(a_mem_obj); clReleaseMemObject(b_mem_obj); clReleaseMemObject(c_mem_obj);
clReleaseCommandQueue(command_queue); clReleaseContext(context);
```
Пояснения к аргументам:
- `CL_TRUE` в Write/ReadBuffer означает **blocking** операцию: функция возвращается после завершения копирования.
- Три последних аргумента `0, NULL, NULL`: число событий в wait list, сам wait list и выходное событие.
- Все функции возвращают значения **через аргументы-указатели**, а статус (`cl_int`, `CL_SUCCESS`) — как return value или через последний `&ret`.

### Kernel
```c
__kernel void vector_add(__global const int *A, __global const int *B, __global int *C) {
    int i = get_global_id(0);   // индекс текущего элемента
    C[i] = A[i] + B[i];
}
```
**Traditional loop → data-parallel kernel:**
```c
void trad_mul(int n, const float *a, const float *b, float *c) {
    for (int i = 0; i < n; i++) c[i] = a[i] * b[i];
}
kernel void dp_mul(global const float *a, global const float *b, global float *c) {
    int id = get_global_id(0);
    c[id] = a[id] * b[id];
}   // execute over "n" work-items
```
Цикл исчезает: каждую итерацию выполняет отдельный work-item.

### Multiple kernels
- Kernel (главная функция GPU) вызывается из host-кода на CPU.
- Host может запускать **несколько kernels** подряд, с одинаковой или разной функциональностью.
- Схема: `load_problem() → kernel() → sync() → get_results()` для Kernel 1, затем то же для Kernel 2.

### Release
`clReleaseMemObject`, `clReleaseKernel`, `clReleaseProgram`, `clReleaseCommandQueue`, `clReleaseContext`.

---

## 9. Примеры кода (code/Codes)

- **0-Detecting OpenCL platforms**: идиома **двух вызовов**:
  ```cpp
  clGetPlatformIDs(0, NULL, &platformCount);              // 1) узнать количество
  std::vector<cl_platform_id> platforms(platformCount);
  clGetPlatformIDs(platformCount, platforms.data(), NULL); // 2) получить список
  clGetPlatformInfo(platforms[i], CL_PLATFORM_NAME, 128, name, NULL);
  ```
- **1-Specification of devices / CPU GPU NPU scanner**: для каждой платформы `clGetDeviceIDs(..., CL_DEVICE_TYPE_ALL, ...)`, затем `clGetDeviceInfo` с параметрами:
  - `CL_DEVICE_NAME`, `CL_DEVICE_VENDOR`, `CL_DEVICE_VERSION`, `CL_DEVICE_OPENCL_C_VERSION`, `CL_DRIVER_VERSION`;
  - `CL_DEVICE_TYPE` (`CL_DEVICE_TYPE_GPU / CPU / ACCELERATOR`);
  - `CL_DEVICE_MAX_COMPUTE_UNITS`, `CL_DEVICE_MAX_CLOCK_FREQUENCY` (MHz), `CL_DEVICE_ADDRESS_BITS`;
  - `CL_DEVICE_GLOBAL_MEM_SIZE`, `CL_DEVICE_MAX_MEM_ALLOC_SIZE`, `CL_DEVICE_LOCAL_MEM_SIZE`;
  - `CL_DEVICE_MAX_WORK_GROUP_SIZE`, `CL_DEVICE_MAX_WORK_ITEM_DIMENSIONS`, `CL_DEVICE_MAX_WORK_ITEM_SIZES`.

  Для строк тоже два вызова: сначала узнать размер (`param_value_size_ret`), потом прочитать.
  NPU может определиться как `CL_DEVICE_TYPE_ACCELERATOR` или не появиться совсем. Совпадение имени ("NPU"/"Neural") — только подсказка.
- **2-1 Host + 2-2 Kernel** (kernel в отдельном файле `vector_add_kernel.cl`): `C = alpha*A + B` (SAXPY-подобно, int), 4 аргумента. Скаляр передаётся как `clSetKernelArg(kernel, 0, sizeof(int), &alpha)`, буферы как `sizeof(cl_mem)`. Устройство `CL_DEVICE_TYPE_GPU`, очередь `clCreateCommandQueueWithProperties` (старая `clCreateCommandQueue` deprecated). Global size 1024, local 64, то есть 16 work-groups.
  - Подвох: `endTime = clock()` берётся **сразу после `clEnqueueNDRangeKernel`**, а это неблокирующий вызов. Измеряется время постановки в очередь, а не выполнения (kernel реально завершается к blocking `clEnqueueReadBuffer`).
- **3-host and kernel**: kernel `saxpy_kernel` хранится **строкой в host-коде** (`const char*`), передаётся в `clCreateProgramWithSource(context, 1, &saxpy_kernel, NULL, ...)`. `NULL` вместо lengths означает, что строка null-terminated. Результат `C[i] = 2*i + (1024 - i) = i + 1024`.
