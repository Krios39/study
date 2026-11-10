# Лекция 09: OpenCL I

Слайды: GPGPU-Lecture_1.pdf

(Заголовок слайдов: «Introduction of OpenCL and GPU Computing».)

---

## 1. GPGPU

**Определение.** A **general-purpose GPU (GPGPU)** — GPU, который выполняет **non-specialized calculations**, то есть задачи, которые обычно выполняет CPU.

Применения: physics calculations, encryption/decryption, scientific computations, cryptocurrencies (Bitcoin), image processing.

### GPU vs CPU
- GPU рендерит изображения быстрее CPU благодаря **parallel processing architecture**: много вычислений одновременно. Эту особенность используют не только для графики.
- **CPU** имеет **higher clock speed**, поэтому быстрее на **отдельных** вычислениях и эффективнее в **small-scale iterative** algorithms.
- **GPU** лучше в **large-scale parallel** computing iterations.
- Комбинация **CPU + GPU** даёт лучшую производительность.
- CPU: **few cores**, оптимизированы для serial processing или ограниченного параллелизма. GPU: **thousands of smaller, more efficient cores**.
- Программа состоит из двух частей:
  - **Host code**: serial-часть, выполняется на **CPU**;
  - **Kernel code**: parallel-часть, выполняется на **GPU**.

---

## 2. CUDA

- **CUDA**: parallel computing platform and programming model от **NVIDIA** для GPGPU.
- Работает на Windows, Linux, macOS, но **only NVIDIA hardware**.
- OpenCL работает почти на любой ОС и большинстве видов железа.
- **Typical program structure (host):**
  1. Allocate memory on the GPU
  2. Transfer input data to the GPU
  3. Launch kernel on the GPU
  4. Transfer output data to CPU

  Kernel: `__global__ void kernel(...) { /* code executed on the GPU */ }`

---

## 3. OpenCL

- **OpenCL (Open Computing Language)**: framework для программ, выполняющихся параллельно на разных compute devices (CPUs, GPUs) от разных вендоров (AMD, Intel, ATI, Nvidia…).
- Две части кода: **Host code** (общая структура и вызов kernel) и **Kernel code**.
- Framework задаёт **язык для kernels**, то есть функций, которые выполняются на устройствах.
- Нужны **новейшие драйверы** видеокарты с поддержкой OpenCL.

### OpenCL Features
- Стандарт **Khronos Group**, версии 1.0, 1.1, 1.2, 2.0, 2.1, 2.2. **1.2 остаётся фактическим стандартом** (de-facto).
- Major backers: **Apple, AMD, Intel**.
- **Alternative to CUDA**, designed for **"heterogeneous computing"**.
- Выполняется на **CPUs, GPUs, DSPs, FPGAs**.
- Структура host program + kernels похожа на CUDA.
- **Restrictions:** **no recursion, variadics, or function pointers**; **cannot dynamically allocate memory from device**.
- OpenCL working group: AMD, ARM, Intel, NVIDIA, IBM, Samsung, Nokia, Apple, Texas Instruments, EA, Activision Blizzard и др.

### CUDA vs OpenCL
| | CUDA | OpenCL |
|---|---|---|
| Performance | не определена, зависит от качества кода, железа и т.д. | то же |
| Vendor implementation | only NVIDIA | TONS of vendors (AMD, NVIDIA, Intel, Apple…) |
| Portability | only NVIDIA hardware | portable, если избегать vendor-specific extensions |
| Open-source vs commercial | proprietary (NVIDIA) | open standard |
| OS support | все основные ОС, но нужен NVIDIA HW | разные ОС |
| Libraries | extensive high-performance | много, но меньше, чем у CUDA |
| Community | larger | growing, меньше |

### Terminology: CUDA ↔ OpenCL (с пометками со слайда)
| CUDA | OpenCL | Пометка на слайде |
|---|---|---|
| Host Memory | Host Memory | RAM (CPU accessible) |
| Global/Device Memory | Global Memory | RAM in GPU, **all kernels** |
| Local Memory | Global Memory | RAM in GPU |
| Constant Memory | Constant Memory | RAM in GPU |
| Shared Memory | **Local Memory** | **one workgroup** |
| Registers | **Private Memory** | **one kernel** (одного экземпляра, то есть work-item) |
| Grid | **NDRange** | |
| Block | **Work group** | **group of kernels** (группа экземпляров kernel) |
| Thread | **Work item** | |
| Thread ID | Global ID | |
| Block Index | Block ID | |
| Thread Index | Local ID | |

На этом слайде «kernel» означает **один выполняющийся экземпляр** kernel'а (work-item).

---

## 4. Установка и настройка

- Нужны свежие драйверы, без поддержки OpenCL в драйвере ничего не работает.
- NVIDIA и AMD выпустили реализации OpenCL для своих GPU, у Intel есть своя. На **macOS** OpenCL от Apple уже установлен.
  - AMD GPUs/CPUs → **AMD APP SDK**
  - NVIDIA GPUs → **CUDA Toolkit**
  - Intel CPUs/GPUs → **Intel OpenCL SDK**
- OpenCL работает с **любым компилятором**, если есть библиотеки. Можно использовать Visual Studio (2022).

---

## 5. Programming in OpenCL: основные понятия («Important»)

- **Platform** — **реализация** OpenCL (Intel, Nvidia). **Device** — реальное **железо** в машине (GPU…).
- Для работы с GPU/CPU через OpenCL нужны:
  - **Context**: одно или несколько devices (GPU, CPU) и память;
    - **Program**: содержит kernels, которые компилируются для разных devices;
    - **Kernel**: метод, который выполняется на device (обычно GPU, но может и CPU);
  - **Command Queue**: управляет выполнением задач и передачей данных между CPU и devices;
  - **Buffer**: данные, которые обработает kernel или которые нужно передать host↔device:
    - **Write to Buffer**: передать аргументы в **Global Memory** устройства;
    - **Execute Kernel**: поставить параллельное выполнение в очередь;
    - **Read from Buffer**: получить результат обратно в HOST program.

---

## 6. Host program шаг за шагом

Host program **управляет выполнением kernels** на устройствах. Пишется на C, есть bindings для C++ и Python.

Общий принцип API: **функции возвращают значения через аргументы-указатели**, а return value (`cl_int`) — это **status/error** code (`CL_SUCCESS` = 0). Функции `clCreate*` возвращают объект, а статус пишут в последний аргумент `&ret`.

**1. Platform** (NVIDIA, AMD, Intel):
```c
cl_int ret = clGetPlatformIDs(1, &platform_id, &ret_num_platforms);
//  1 — input: сколько платформ хотим; &platform_id — output; &ret_num_platforms — output: сколько есть
```
**2. Device** (GPU или CPU):
```c
ret = clGetDeviceIDs(platform_id, CL_DEVICE_TYPE_DEFAULT, 1, &device_id, &ret_num_devices);
// типы: CL_DEVICE_TYPE_DEFAULT / _GPU / _CPU / _ACCELERATOR / _ALL
```
**3. Context:**
```c
cl_context context = clCreateContext(NULL, 1, &device_id, NULL, NULL, &ret);
```
**4. Command queue:**
```c
cl_command_queue command_queue = clCreateCommandQueue(context, device_id, 0, &ret);
// с OpenCL 2.0: clCreateCommandQueueWithProperties(context, device_id, NULL, &ret)
```
**5. Memory buffer objects:**
```c
cl_mem a_mem_obj = clCreateBuffer(context, CL_MEM_READ_ONLY,  LIST_SIZE * sizeof(int), NULL, &ret);
cl_mem b_mem_obj = clCreateBuffer(context, CL_MEM_READ_ONLY,  LIST_SIZE * sizeof(int), NULL, &ret);
cl_mem c_mem_obj = clCreateBuffer(context, CL_MEM_WRITE_ONLY, LIST_SIZE * sizeof(int), NULL, &ret);
```
Флаги задают доступ **со стороны kernel**: A и B только читаются, C только пишется.

**6. Transfer A, B на device:**
```c
ret = clEnqueueWriteBuffer(command_queue, a_mem_obj, CL_TRUE, 0, LIST_SIZE * sizeof(int), A, 0, NULL, NULL);
ret = clEnqueueWriteBuffer(command_queue, b_mem_obj, CL_TRUE, 0, LIST_SIZE * sizeof(int), B, 0, NULL, NULL);
// CL_TRUE = blocking; 0 = offset; size; host ptr; 0, NULL, NULL = event wait list / event
```
**7. Load kernel source** (kernel в отдельном файле):
```c
FILE *fp = fopen("vector_add_kernel.cl", "r");
if (!fp) { fprintf(stderr, "Failed to load kernel.\n"); exit(1); }
char *source_str = (char*)malloc(MAX_SOURCE_SIZE);
size_t source_size = fread(source_str, 1, MAX_SOURCE_SIZE, fp);
fclose(fp);
```
**8. Program object:**
```c
cl_program program = clCreateProgramWithSource(context, 1, (const char **)&source_str,
                                                (const size_t *)&source_size, &ret);
```
**9. Build:** **online** (компиляция kernel во время выполнения программы) или **offline** (заранее скомпилированная программа, загружается перед запуском):
```c
ret = clBuildProgram(program, 1, &device_id, NULL, NULL, NULL);
```
**10. Kernel object** (строка = имя `__kernel`-функции):
```c
cl_kernel kernel = clCreateKernel(program, "vector_add", &ret);
```
**11. Kernel arguments** (индекс = позиция параметра):
```c
ret = clSetKernelArg(kernel, 0, sizeof(cl_mem), (void *)&a_mem_obj);
ret = clSetKernelArg(kernel, 1, sizeof(cl_mem), (void *)&b_mem_obj);
ret = clSetKernelArg(kernel, 2, sizeof(cl_mem), (void *)&c_mem_obj);
```
**12. Execute:**
```c
size_t global_item_size = LIST_SIZE;  // всего work-items
size_t local_item_size  = 64;         // work-items в work-group
ret = clEnqueueNDRangeKernel(command_queue, kernel, 1, NULL,
                             &global_item_size, &local_item_size, 0, NULL, NULL);
// 1 = work_dim, NULL = global offset
```
**13. Read result C:**
```c
int *C = (int*)malloc(sizeof(int) * LIST_SIZE);
ret = clEnqueueReadBuffer(command_queue, c_mem_obj, CL_TRUE, 0, LIST_SIZE * sizeof(int), C, 0, NULL, NULL);
```
(Освобождение ресурсов `clRelease*` — в OpenCL II.)

---

## 7. Kernel program

Kernel выполняется на GPU:
```c
__kernel void vector_add(__global const int *A, __global const int *B, __global int *C) {
    int i = get_global_id(0);   // индекс текущего элемента
    C[i] = A[i] + B[i];
}
```
- `__kernel` (или `kernel`): функция-точка входа, вызываемая с host, возвращает `void`.
- `__global`: указатель на global memory (буферы).
- `get_global_id(0)`: уникальный индекс work-item в измерении 0.

### Traditional loop → data-parallel OpenCL
```c
void trad_mul(int n, const float *a, const float *b, float *c) {
    int i;
    for (i = 0; i < n; i++) c[i] = a[i] * b[i];
}
kernel void dp_mul(global const float *a, global const float *b, global float *c) {
    int id = get_global_id(0);
    c[id] = a[id] * b[id];
}   // execute over "n" work-items
```
Тело цикла становится kernel'ом, а **итерация превращается в work-item**. Число итераций задаёт global size в `clEnqueueNDRangeKernel`.

Исходник примера (Hello World / vector add): eriksmistad.no «Getting started with OpenCL and GPU computing».
