# Карточки — Лекция 08: General-Purpose GPU and NPU Programming

<details>
<summary><b>Q:</b> What is a GPGPU?</summary>

A general-purpose GPU — это GPU, который выполняет **неспециализированные вычисления**, то есть задачи, которые обычно делает CPU. Примеры: physics, encryption/decryption, scientific computations, cryptocurrencies (Bitcoin), image processing.

</details>

<details>
<summary><b>Q:</b> CPU vs GPU: cores, clock speed, and which workloads each is better at?</summary>

- **CPU:** few cores, оптимизированы для serial processing. Clock speed выше, поэтому CPU быстрее на одиночных вычислениях и эффективнее в **small-scale iterative** algorithms.
- **GPU:** thousands of smaller, more efficient cores. Лучше в **large-scale parallel** iterations.
- Комбинация CPU + GPU даёт лучшую производительность.

</details>

<details>
<summary><b>Q:</b> What are host code and kernel code?</summary>

- **Host code**: последовательная часть, выполняется на **CPU**. Управляет устройством, памятью и запуском kernels.
- **Kernel code**: параллельная часть, выполняется на **GPU** (device), во многих экземплярах.

</details>

<details>
<summary><b>Q:</b> What is CUDA and what is its main limitation?</summary>

Parallel computing platform and programming model от **NVIDIA** для GPGPU. Работает на Windows, Linux, macOS, но **только на NVIDIA hardware**. Это proprietary framework.

</details>

<details>
<summary><b>Q:</b> What are the 4 steps of a typical CUDA program (host side)?</summary>

1. Allocate memory on the GPU
2. Transfer input data to the GPU
3. Launch kernel on the GPU
4. Transfer output data to CPU

Kernel помечается `__global__`.

</details>

<details>
<summary><b>Q:</b> What is OpenCL? Who maintains it, and which devices can it run on?</summary>

**Open Computing Language**: открытый стандарт для параллельных программ на устройствах разных вендоров. Поддерживает **Khronos Group**, основные сторонники Apple, AMD, Intel. Рассчитан на **heterogeneous computing**: CPUs, GPUs, DSPs, FPGAs.

</details>

<details>
<summary><b>Q:</b> Name the restrictions of OpenCL kernels mentioned in the lecture.</summary>

- No **recursion**
- No **variadic** functions
- No **function pointers**
- **Cannot dynamically allocate memory** on the device (нет malloc в kernel)

</details>

<details>
<summary><b>Q:</b> CUDA vs OpenCL: vendor, portability, licence, libraries, community?</summary>

| | CUDA | OpenCL |
|---|---|---|
| Vendor | только NVIDIA | множество (AMD, NVIDIA, Intel, Apple…) |
| Portability | только NVIDIA HW | переносим, если без vendor extensions |
| Licence | proprietary | open standard |
| Libraries | extensive | меньше |
| Community | больше | растёт, меньше |
| Performance | зависит от кода и железа | то же самое |

</details>

<details>
<summary><b>Q:</b> Translate CUDA terms to OpenCL: Grid, Block, Thread, Shared Memory, Registers.</summary>

- Grid → **NDRange**
- Block → **Work group**
- Thread → **Work item**
- Shared Memory → **Local Memory**
- Registers → **Private Memory**

(и ещё: Thread ID → Global ID, Block Index → Block/Group ID, Thread Index → Local ID)

</details>

<details>
<summary><b>Q:</b> Is "local memory" the same thing in CUDA and OpenCL?</summary>

**Нет.**
- В OpenCL **local memory** общая для work-group, это аналог CUDA **shared memory**.
- В CUDA **local memory** — приватные данные потока, физически лежащие в global memory. В таблице слайда она сопоставлена OpenCL **Global Memory**.

</details>

<details>
<summary><b>Q:</b> Match framework to developer and key advantage: oneAPI, SYCL, HIP, Numba, Triton.</summary>

- **oneAPI**: Intel, C++/DPC++. Единое программирование для CPU, GPU, FPGA.
- **SYCL**: Khronos, C++. Portable **single-source** GPU programming.
- **HIP**: AMD, CUDA-like C++. Работает на AMD **и** NVIDIA.
- **Numba**: Anaconda, Python. **JIT**-компиляция Python для GPU.
- **Triton**: OpenAI, Python. Простые custom GPU kernels для deep learning.

</details>

<details>
<summary><b>Q:</b> PyTorch vs CUDA/OpenCL/SYCL/oneAPI: what is the main difference?</summary>

- **PyTorch:** high-level Python API для DL. GPU control и tuning автоматические (cuDNN, TorchScript, Triton), пример `torch.matmul(a, b)`.
- **CUDA/OpenCL/SYCL/oneAPI:** low-level C/C++ kernels для general-purpose вычислений. Разработчик сам пишет kernels и оптимизирует вручную.

</details>

<details>
<summary><b>Q:</b> Place in High / Mid / Low level: PyTorch, cuDNN, OpenCL, JAX, ROCm, SYCL, TensorFlow, Triton, CUDA, oneAPI.</summary>

- **High:** PyTorch, TensorFlow, JAX
- **Mid:** cuDNN, ROCm, Triton
- **Low:** OpenCL, CUDA, SYCL, oneAPI

</details>

<details>
<summary><b>Q:</b> What is an NPU and how does it differ from a GPU?</summary>

**Neural Processing Unit** — специализированный процессор только для **AI/ML**, «mimics how the human brain works».
- **GPU** — generalist: параллельная математика и графика, высокое энергопотребление.
- **NPU** — specialist для AI (inference), **гораздо меньше энергии и батареи**.

</details>

<details>
<summary><b>Q:</b> CPU vs GPU vs NPU execution models: name and primary role of each.</summary>

- **CPU (The Brain):** general-purpose logic & control, fast serial execution, limited parallelism.
- **GPU (Massive SIMD):** heavy parallel math & graphics, thousands of ops simultaneously, high power draw, programmed via OpenCL/CUDA.
- **NPU (Spatial Tensor):** dedicated AI & neural workloads (matrix math), ultra-low power, targeted via OpenVINO.

</details>

<details>
<summary><b>Q:</b> What do TOPS, W and TOPS/W mean? Which processor has the best TOPS/W?</summary>

- **TOPS** — Tera Operations Per Second, то есть скорость.
- **W** — мощность (watts).
- **TOPS/W** — работа на 1 Вт, то есть энергоэффективность. Чем выше, тем лучше.

Порядок по слайду: CPU ~0.3, iGPU ~1.2, **NPU 8.0+ TOPS/W** (NPU: 45–120+ TOPS при 2–10 W).

</details>

<details>
<summary><b>Q:</b> Memory access model and optimal tasks for CPU, iGPU and NPU (from the metrics table)?</summary>

- **CPU:** L3 Cache → DRAM, sequential logic.
- **iGPU:** shared system RAM, batch image/video.
- **NPU:** direct local SRAM, continuous local AI.

</details>

<details>
<summary><b>Q:</b> How is a GPU vs an NPU programmed in heterogeneous systems? What is the modern trend?</summary>

- GPU: low-level фреймворки **OpenCL / CUDA** (custom kernels).
- NPU: AI-фреймворки, например **Intel OpenVINO** (inference).
- Trend: **CPU + GPU + NPU** в одной системе, каждая нагрузка идёт на подходящее железо.

</details>

<details>
<summary><b>Q:</b> What does this OpenVINO code print on the lecturer's laptop?

```cpp
ov::Core core;
std::string full_name = core.get_property("NPU", ov::device::full_name);
std::cout << "Success! Connected to: " << full_name << std::endl;
```
</summary>

`Success! Connected to: Intel(R) AI Boost`

Мысль слайда: в отличие от OpenCL (свои kernels и buffers вручную), OpenVINO позволяет обратиться к NPU в несколько строк.

</details>

<details>
<summary><b>Q:</b> Steps of adding two vectors on an NPU with OpenVINO?</summary>

1. Создать `ov::op::v0::Parameter` (f32, Shape{1024}) ×2
2. Узел `ov::op::v1::Add(p1, p2)`, то есть граф операций
3. `ov::Model(...)` из outputs и parameters
4. `core.compile_model(model, "NPU")`
5. `create_infer_request()`
6. Заполнить `ov::Tensor`, вызвать `set_input_tensor(i, t)`
7. `infer()`
8. `get_output_tensor().data<float>()`

Вместо kernel здесь **model/graph**.

</details>

<details>
<summary><b>Q:</b> Define NDRange, work-group, wavefront, work-item.</summary>

- **NDRange**: index space, задаёт **число work-items** на устройстве (1–3 измерения).
- **Work-item**: один экземпляр kernel (поток).
- **Work-group**: группа work-items. На неё делится NDRange.
- **Wavefront**: аппаратная группа work-items (AMD, HW-specific size), на которые делится work-group. Аналог NVIDIA warp.

</details>

<details>
<summary><b>Q:</b> What do `get_global_id`, `get_local_id`, `get_group_id`, `get_local_size`, `get_num_groups`, `get_global_size` return?</summary>

- `get_global_id(d)`: ID work-item во всём NDRange, $[0, WI)$
- `get_local_id(d)`: ID внутри work-group, $[0, WI/WG)$
- `get_group_id(d)`: ID work-group, $[0, WG)$
- `get_local_size(d)`: work-items в группе $= WI/WG$
- `get_num_groups(d)`: число групп $WG$
- `get_global_size(d)`: всего work-items $WI$

(+ `get_work_dim()` даёт число измерений, `get_global_offset(d)` — offset из `clEnqueueNDRangeKernel`)

</details>

<details>
<summary><b>Q:</b> global size = 1024, local size = 64. How many work-groups? What are `get_group_id(0)` and `get_local_id(0)` for global id 200?</summary>

- Work-groups: $1024/64 = 16$
- `get_group_id(0)` $= \lfloor 200/64 \rfloor = 3$
- `get_local_id(0)` $= 200 \bmod 64 = 8$

(проверка: $3\cdot 64 + 8 = 200$)

</details>

<details>
<summary><b>Q:</b> Describe the OpenCL memory model: who can access global, constant, local, private, host memory?</summary>

- **Global**: любой work-item читает и пишет любое место (память устройства).
- **Constant**: память устройства, **read-only** для kernels.
- **Local**: общая для **всех work-items одной work-group**.
- **Private**: только **один work-item** (`__private`).
- **Host**: основная RAM хоста. Обмен с device идёт через buffers.

</details>

<details>
<summary><b>Q:</b> How do you find out the amount of global memory of a device?</summary>

`clGetDeviceInfo(device, CL_DEVICE_GLOBAL_MEM_SIZE, sizeof(cl_ulong), &mem, NULL);`

(аналогично `CL_DEVICE_LOCAL_MEM_SIZE`, `CL_DEVICE_MAX_MEM_ALLOC_SIZE`, `CL_DEVICE_MAX_WORK_GROUP_SIZE`, `CL_DEVICE_MAX_COMPUTE_UNITS`)

</details>

<details>
<summary><b>Q:</b> What are the two types of synchronization in OpenCL?</summary>

1. Among **work-items** within a **work-group** (barrier).
2. Among **command queues** within a **context**.

</details>

<details>
<summary><b>Q:</b> What does `barrier(CLK_LOCAL_MEM_FENCE)` / `work_group_barrier()` do? What flags exist?</summary>

Каждый work-item ждёт, пока **все work-items его work-group** дойдут до этого барьера, затем все продолжают.

Flags:
- `CLK_LOCAL_MEM_FENCE`: упорядочивает доступ к local memory;
- `CLK_GLOBAL_MEM_FENCE`: упорядочивает доступ к global memory.

Барьер действует **только внутри work-group**, не между группами.

</details>

<details>
<summary><b>Q:</b> List the OpenCL objects you need to run a kernel (context, program, …) with one-line roles.</summary>

- **Context**: связывает устройства и память.
- **Program**: содержит kernels и компилирует под устройства.
- **Kernel**: функция на устройстве.
- **Command Queue**: исполнение и передача данных host↔device.
- **Buffer** (`cl_mem`): данные на устройстве.

Операции: **Write to buffer → Execute kernel → Read from buffer**.

</details>

<details>
<summary><b>Q:</b> Put the OpenCL host program steps in order.</summary>

1. `clGetPlatformIDs`
2. `clGetDeviceIDs`
3. `clCreateContext`
4. `clCreateCommandQueue` (`...WithProperties`)
5. `clCreateBuffer`
6. `clEnqueueWriteBuffer`
7. `clCreateProgramWithSource`
8. `clBuildProgram`
9. `clCreateKernel`
10. `clSetKernelArg`
11. `clEnqueueNDRangeKernel`
12. `clEnqueueReadBuffer`
13. `clRelease*` (MemObject, Kernel, Program, CommandQueue, Context)

</details>

<details>
<summary><b>Q:</b> Explain the arguments: `clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local, 0, NULL, NULL)`.</summary>

- `1`: work_dim (1D NDRange)
- `NULL`: global work offset
- `&global`: global work size (всего work-items)
- `&local`: local work size (work-items в группе)
- `0, NULL`: wait list событий (пусто)
- `NULL`: выходное event не нужно

</details>

<details>
<summary><b>Q:</b> What does `CL_TRUE` mean in `clEnqueueWriteBuffer(queue, buf, CL_TRUE, 0, size, A, 0, NULL, NULL)`?</summary>

**Blocking write**: вызов возвращается только после того, как данные скопированы и host-буфер `A` можно снова использовать. `0` — это offset в буфере, `size` — число байт.

</details>

<details>
<summary><b>Q:</b> What is the difference between online and offline compilation of OpenCL kernels?</summary>

- **Online:** kernel source компилируется **во время выполнения** программы (`clCreateProgramWithSource` + `clBuildProgram`).
- **Offline:** используется **заранее скомпилированная** программа, которую загружают перед запуском.

</details>

<details>
<summary><b>Q:</b> Write the OpenCL kernel for C = A + B and explain how it replaces the loop.</summary>

```c
__kernel void vector_add(__global const int *A, __global const int *B, __global int *C) {
    int i = get_global_id(0);
    C[i] = A[i] + B[i];
}
```
Цикла `for` нет: запускается N work-items, каждый обрабатывает **свой** индекс `i`.

</details>

<details>
<summary><b>Q:</b> How do you pass a scalar vs a buffer to a kernel with `clSetKernelArg`?</summary>

```c
clSetKernelArg(kernel, 0, sizeof(int),    (void*)&alpha);     // скаляр по значению
clSetKernelArg(kernel, 1, sizeof(cl_mem), (void*)&a_mem_obj); // буфер — handle cl_mem
```
Индекс аргумента — его позиция в сигнатуре `__kernel`.

</details>

<details>
<summary><b>Q:</b> Why do the example programs call `clGetPlatformIDs` twice?</summary>

Идиома двух вызовов:
1. `clGetPlatformIDs(0, NULL, &count)` узнаёт **количество**.
2. Выделяется массив, затем `clGetPlatformIDs(count, platforms, NULL)` **заполняет** его.

Так же делают `clGetDeviceIDs` и `clGetDeviceInfo` для строк (сначала размер, потом данные).

</details>

<details>
<summary><b>Q:</b> What is wrong with this timing in the example host code?

```c
clock_t start = clock();
...
ret = clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &g, &l, 0, NULL, NULL);
clock_t end = clock();
ret = clEnqueueReadBuffer(queue, c_mem, CL_TRUE, ...);
```
</summary>

`clEnqueueNDRangeKernel` **неблокирующий**: он только ставит kernel в очередь. `end` берётся до того, как kernel реально выполнился, поэтому время kernel не измеряется. Нужно сначала `clFinish(queue)` (или event profiling), а потом брать `end`.

</details>

<details>
<summary><b>Q:</b> Kernel `C[i] = alpha*A[i] + B[i]` with alpha=2, A[i]=i, B[i]=1024-i. What is C[i]?</summary>

$C[i] = 2i + 1024 - i = i + 1024$. Например, C[0]=1024, C[9]=1033.

</details>

<details>
<summary><b>Q:</b> How can host code run multiple kernels, and why can that give global synchronization?</summary>

Host последовательно запускает Kernel 1 (`kernel() → sync() → get_results()`), потом Kernel 2 и т.д. Kernels могут быть одинаковыми или разными. Между запусками **все** work-items предыдущего kernel уже завершены. Это синхронизация по всему NDRange, которой не даёт barrier внутри work-group.

</details>

<details>
<summary><b>Q:</b> Which functions release OpenCL resources?</summary>

`clReleaseMemObject(buf)`, `clReleaseKernel(kernel)`, `clReleaseProgram(program)`, `clReleaseCommandQueue(queue)`, `clReleaseContext(context)`.

(перед этим можно вызвать `clFlush` / `clFinish(queue)`)

</details>
