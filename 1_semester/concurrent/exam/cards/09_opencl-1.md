# Карточки — Лекция 09: OpenCL I

<details>
<summary><b>Q:</b> Define GPGPU and give example applications.</summary>

A general-purpose GPU — GPU, который выполняет **non-specialized calculations**, то есть задачи, которые обычно делает CPU. Примеры: physics, encryption/decryption, scientific computations, Bitcoin mining, image processing.

</details>

<details>
<summary><b>Q:</b> Why is a GPU faster than a CPU for some tasks, yet a CPU is faster for others?</summary>

- **GPU:** тысячи небольших ядер, parallel architecture, поэтому выигрывает на **large-scale parallel** iterations.
- **CPU:** несколько мощных ядер с **higher clock speed**, поэтому быстрее на **отдельных вычислениях** и в **small-scale iterative** algorithms.
- Лучше всего работает комбинация CPU + GPU.

</details>

<details>
<summary><b>Q:</b> Which part of the code runs on the CPU and which on the GPU?</summary>

- **Host code** (serial part) выполняется на **CPU**.
- **Kernel code** (parallel part) выполняется на **GPU**.

</details>

<details>
<summary><b>Q:</b> CUDA: who develops it, and where does it run?</summary>

**NVIDIA**. Работает на Windows, Linux, macOS, но **только на NVIDIA hardware**. OpenCL работает почти на любой ОС и большинстве видов железа.

</details>

<details>
<summary><b>Q:</b> What is OpenCL and what are its two code parts?</summary>

**Open Computing Language**: framework для параллельных программ на compute devices разных вендоров (CPU, GPU, …). Две части:
- **Host code**: общая структура, вызывает kernel;
- **Kernel code**: функции на OpenCL C, выполняются на devices.

</details>

<details>
<summary><b>Q:</b> Who maintains OpenCL, which version is the de-facto standard, and who are the major backers?</summary>

**Khronos Group**. Версии 1.0–2.2, **1.2** — de-facto standard. Major backers: **Apple, AMD, Intel**.

</details>

<details>
<summary><b>Q:</b> On which kinds of devices can OpenCL run?</summary>

CPUs, GPUs, **DSPs**, **FPGAs**. OpenCL рассчитан на **heterogeneous computing**.

</details>

<details>
<summary><b>Q:</b> Name OpenCL kernel language restrictions.</summary>

- No recursion
- No variadic functions
- No function pointers
- Cannot dynamically allocate memory on the device

</details>

<details>
<summary><b>Q:</b> Give 4 differences between CUDA and OpenCL.</summary>

1. Vendor: CUDA only NVIDIA, OpenCL — много вендоров.
2. Portability: CUDA only NVIDIA HW, OpenCL переносим (без vendor extensions).
3. Licence: CUDA proprietary, OpenCL open standard.
4. Libraries/community: у CUDA больше, у OpenCL меньше, но растёт.

Performance у обоих не определена заранее: зависит от кода и железа.

</details>

<details>
<summary><b>Q:</b> CUDA → OpenCL: Grid, Block, Thread, Thread ID, Block Index, Thread Index?</summary>

- Grid → **NDRange**
- Block → **Work group**
- Thread → **Work item**
- Thread ID → **Global ID**
- Block Index → **Block ID**
- Thread Index → **Local ID**

</details>

<details>
<summary><b>Q:</b> CUDA → OpenCL memory names: Shared Memory, Registers, Global/Device Memory?</summary>

- Shared Memory → **Local Memory** (одна work-group)
- Registers → **Private Memory** (один work-item)
- Global/Device Memory → **Global Memory** (доступна всем)

</details>

<details>
<summary><b>Q:</b> Platform vs device in OpenCL?</summary>

- **Platform** — **реализация** OpenCL от вендора (Intel, NVIDIA, AMD).
- **Device** — реальное **железо** в машине (конкретный GPU, CPU).

Одна платформа может содержать несколько devices.

</details>

<details>
<summary><b>Q:</b> What is an OpenCL context?</summary>

Окружение, которое объединяет **одно или несколько devices** и **память** (buffers), а также programs, kernels и command queues для них.

</details>

<details>
<summary><b>Q:</b> Program vs kernel in OpenCL?</summary>

- **Program** (`cl_program`): контейнер исходного кода/бинарника, **содержит kernels** и компилируется (`clBuildProgram`) под devices.
- **Kernel** (`cl_kernel`): конкретная `__kernel`-функция из программы, «метод», который выполняется на device. Создаётся через `clCreateKernel(program, "name", &ret)`.

</details>

<details>
<summary><b>Q:</b> What does a command queue do?</summary>

Управляет **выполнением** команд и **передачей данных** между host (CPU) и device. Через неё ставятся в очередь write buffer, NDRange kernel и read buffer. Очередь создаётся для пары context + device.

</details>

<details>
<summary><b>Q:</b> What is a buffer, and what are the three buffer-related operations of an OpenCL program?</summary>

**Buffer** (`cl_mem`): память на device с данными для kernel или для обмена host↔device.
1. **Write to buffer**: host → Global Memory устройства.
2. **Execute kernel**: поставить параллельное выполнение.
3. **Read from buffer**: результат device → host.

</details>

<details>
<summary><b>Q:</b> Put the OpenCL host program steps in the correct order.</summary>

1. Get platform: `clGetPlatformIDs`
2. Get device: `clGetDeviceIDs`
3. Create context: `clCreateContext`
4. Create command queue: `clCreateCommandQueue`
5. Create buffers: `clCreateBuffer`
6. Write input: `clEnqueueWriteBuffer`
7. Load source and create program: `clCreateProgramWithSource`
8. Build: `clBuildProgram`
9. Create kernel: `clCreateKernel`
10. Set args: `clSetKernelArg`
11. Execute: `clEnqueueNDRangeKernel`
12. Read result: `clEnqueueReadBuffer`

</details>

<details>
<summary><b>Q:</b> In `cl_int ret = clGetPlatformIDs(1, &platform_id, &ret_num_platforms);`, what is input, what is output, and what is `ret`?</summary>

- `1`: **input**, сколько платформ запрашиваем.
- `&platform_id`, `&ret_num_platforms`: **output**. Функции OpenCL возвращают значения **через аргументы**.
- `ret`: **status/error code** (`CL_SUCCESS` = 0).

</details>

<details>
<summary><b>Q:</b> What do `CL_MEM_READ_ONLY` and `CL_MEM_WRITE_ONLY` mean in `clCreateBuffer`, and how are they used in vector add?</summary>

Флаги задают, как **kernel** обращается к буферу:
- A, B — `CL_MEM_READ_ONLY` (kernel только читает);
- C — `CL_MEM_WRITE_ONLY` (kernel только пишет результат).

Host при этом может записывать и читать их через Enqueue Write/Read.

</details>

<details>
<summary><b>Q:</b> Explain the parameters of `clEnqueueWriteBuffer(queue, a_mem_obj, CL_TRUE, 0, LIST_SIZE*sizeof(int), A, 0, NULL, NULL)`.</summary>

- `queue`: куда ставится команда
- `a_mem_obj`: целевой буфер на device
- `CL_TRUE`: **blocking** (возврат после завершения копирования)
- `0`: offset в буфере
- `LIST_SIZE*sizeof(int)`: размер в **байтах**
- `A`: указатель на host-данные
- `0, NULL, NULL`: wait list событий и выходное событие (не используются)

</details>

<details>
<summary><b>Q:</b> Online vs offline kernel compilation?</summary>

- **Online:** исходник kernel компилируется **во время работы** программы (`clCreateProgramWithSource` → `clBuildProgram`). Работает на любом device, но тратит время при запуске.
- **Offline:** используется **заранее скомпилированный** бинарник, его загружают перед запуском.

</details>

<details>
<summary><b>Q:</b> What string must be passed to `clCreateKernel(program, "...", &ret)`?</summary>

**Имя `__kernel`-функции** в исходнике программы, например `"vector_add"` для `__kernel void vector_add(...)`. Если имя не совпадает, kernel не будет создан (ошибка в `ret`).

</details>

<details>
<summary><b>Q:</b> Explain `clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global_item_size, &local_item_size, 0, NULL, NULL)` with global = 1024, local = 64.</summary>

- `1`: 1-мерное NDRange
- `NULL`: без global offset
- `global = 1024`: всего work-items
- `local = 64`: размер work-group, то есть $1024/64 = 16$ work-groups
- `0, NULL, NULL`: без событий

Вызов **неблокирующий**: только ставит kernel в очередь.

</details>

<details>
<summary><b>Q:</b> Write the vector-add kernel and explain each keyword.</summary>

```c
__kernel void vector_add(__global const int *A, __global const int *B, __global int *C) {
    int i = get_global_id(0);
    C[i] = A[i] + B[i];
}
```
- `__kernel`: точка входа, вызываемая с host (возвращает void)
- `__global`: данные в global memory
- `get_global_id(0)`: индекс этого work-item в измерении 0

</details>

<details>
<summary><b>Q:</b> How does a traditional `for` loop map to a data-parallel OpenCL kernel?</summary>

```c
for (i = 0; i < n; i++) c[i] = a[i] * b[i];
```
превращается в
```c
kernel void dp_mul(global const float *a, global const float *b, global float *c) {
    int id = get_global_id(0);
    c[id] = a[id] * b[id];
}   // execute over n work-items
```
Цикл исчезает: каждая итерация — отдельный work-item, `n` задаётся global size.

</details>

<details>
<summary><b>Q:</b> What do you need to install to use OpenCL on AMD, NVIDIA, Intel, and macOS?</summary>

Прежде всего свежий драйвер с поддержкой OpenCL. Плюс:
- AMD → **AMD APP SDK**
- NVIDIA → **CUDA Toolkit**
- Intel → **Intel OpenCL SDK**
- macOS → OpenCL от Apple уже установлен

</details>

<details>
<summary><b>Q:</b> In which language is the host program written?</summary>

На **C** (OpenCL API — это C API). Есть bindings для **C++** и **Python** (например, PyOpenCL).

</details>

<details>
<summary><b>Q:</b> What's wrong here?

```c
__kernel void add(__global int *A, __global int *B, __global int *C) {
    for (int i = 0; i < 1024; i++) C[i] = A[i] + B[i];
}
```
(launched with global size 1024)
</summary>

Каждый из 1024 work-items выполняет **весь цикл**: работа повторяется 1024 раза, параллелизма нет, и все пишут в одни и те же ячейки. Должно быть `int i = get_global_id(0); C[i] = A[i] + B[i];`.

</details>
