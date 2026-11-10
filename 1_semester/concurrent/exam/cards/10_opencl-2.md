# Карточки — Лекция 10: OpenCL II

<details>
<summary><b>Q:</b> What is a kernel in OpenCL?</summary>

Программа, которая **дублируется на compute devices**: много её экземпляров выполняются **параллельно** и обрабатывают массив данных. Это код, предназначенный для выполнения на GPU.

</details>

<details>
<summary><b>Q:</b> OpenGL compute shader vs OpenCL compute kernel?</summary>

- **Compute shader (OpenGL)**: вид kernel, выполняется **в 3D graphics pipeline**.
- **Compute kernel (OpenCL)**: **не является частью** 3D graphics pipeline.

</details>

<details>
<summary><b>Q:</b> What is an NDRange?</summary>

N-мерное (1D/2D/3D) пространство индексов, которое задаёт **число work-items** на compute device. Задаётся global size (и local size) в `clEnqueueNDRangeKernel`.

</details>

<details>
<summary><b>Q:</b> Order from largest to smallest and mark software vs hardware: wavefront, NDRange, work-item, work-group.</summary>

**NDRange ⊃ work-group ⊃ wavefront ⊃ work-item**
- Work-group — понятие **software**.
- Wavefront — **hardware** (AMD), размер зависит от железа (у NVIDIA аналог warp).

</details>

<details>
<summary><b>Q:</b> In a 2D kernel processing a matrix, how does a work-item find its row and column?</summary>

```c
int row = get_global_id(0);
int col = get_global_id(1);
```
(как в примере слайда: `get_global_id(0) = row`, `get_global_id(1) = column`)

</details>

<details>
<summary><b>Q:</b> Complete the identity: `get_global_size(0) == ? * ?`</summary>

`get_global_size(0) == get_num_groups(0) * get_local_size(0)`

</details>

<details>
<summary><b>Q:</b> How is `get_global_id` related to `get_group_id`, `get_local_size`, `get_local_id` (no offset)?</summary>

$$\text{global\_id} = \text{group\_id} \cdot \text{local\_size} + \text{local\_id}$$

</details>

<details>
<summary><b>Q:</b> 1D NDRange, global size 256, local size 32. Work-item with global id 100: what are group id, local id, number of groups?</summary>

- `get_num_groups(0)` $= 256/32 = 8$
- `get_group_id(0)` $= \lfloor 100/32 \rfloor = 3$
- `get_local_id(0)` $= 100 \bmod 32 = 4$

</details>

<details>
<summary><b>Q:</b> What do `get_work_dim()` and `get_global_offset(dim)` return?</summary>

- `get_work_dim()`: **число измерений** NDRange (1–3).
- `get_global_offset(dim)`: **offset**, переданный в `clEnqueueNDRangeKernel` (global_work_offset), в измерении `dim`.

</details>

<details>
<summary><b>Q:</b> Describe the 5 memory regions of the OpenCL memory model and who can access each.</summary>

- **Host memory**: RAM хоста (CPU).
- **Global memory**: память устройства, **любой work-item** читает и пишет любое место.
- **Constant memory**: память устройства, **read-only**.
- **Local memory**: общая для **work-items одной work-group**.
- **Private memory**: только **один work-item** (`__private`).

</details>

<details>
<summary><b>Q:</b> What is a buffer object?</summary>

Блок памяти, выделенный OpenCL-программой (`clCreateBuffer`, тип `cl_mem`). Обычно хранит **входные и выходные данные**, которые work-items обрабатывают или генерируют.

</details>

<details>
<summary><b>Q:</b> Which address space qualifiers match which memory? (`__global`, `__constant`, `__local`, `__private`)</summary>

- `__global`: global memory (буферы, видно всем)
- `__constant`: constant memory (read-only)
- `__local`: local memory (одна work-group)
- `__private`: private memory (один work-item). Локальные переменные kernel private по умолчанию.

</details>

<details>
<summary><b>Q:</b> What are the two types of synchronization in OpenCL?</summary>

1. Among **work-items within a work-group**: atomics, fences, barrier.
2. Among **command queues within a context**: events, последовательные kernels.

</details>

<details>
<summary><b>Q:</b> What's the problem in this code, and what fixes it?

```c
// Thread A
x--;
if (x > 0) { /* To do */ }
```
</summary>

Между `x--` и `if (x > 0)` **другой поток (B) может изменить x**. Кроме того, сам `x--` — неатомарный read-modify-write. Результат: race condition.

Решение: **atomic variables / atomic operations**, например `int old = atomic_dec(&x); if (old - 1 > 0) ...`. Используется значение, возвращённое атомарной операцией, а `x` повторно не читается.

</details>

<details>
<summary><b>Q:</b> What is `atomic_work_item_fence()`, which flags does it take, and what older functions does it replace?</summary>

Memory fence: обеспечивает **упорядочение памяти** для атомарных операций и доступа work-item.
- Flags: `CLK_GLOBAL_MEM_FENCE`, `CLK_LOCAL_MEM_FENCE`.
- Эквивалент старых `mem_fence()`, `read_mem_fence()`, `write_mem_fence()`.

</details>

<details>
<summary><b>Q:</b> What does a barrier do in OpenCL? What flags does `barrier()` take?</summary>

Каждый work-item **ждёт, пока все work-items его work-group** дойдут до этого барьера, затем все продолжают.

`barrier(flags)`:
- `CLK_LOCAL_MEM_FENCE`: для local memory;
- `CLK_GLOBAL_MEM_FENCE`: для global memory.

</details>

<details>
<summary><b>Q:</b> `work_group_barrier()` vs `barrier(CLK_LOCAL_MEM_FENCE)`: what's the difference according to the lecture?</summary>

- `work_group_barrier()` синхронизирует **execution flow** work-items внутри work-group (**Execution**).
- `barrier(CLK_LOCAL_MEM_FENCE)` синхронизирует **доступ к local memory** внутри work-group (**Memory**).

(По спецификации Khronos оба являются execution barrier + memory fence. `work_group_barrier` — имя из OpenCL 2.0.)

</details>

<details>
<summary><b>Q:</b> Atomic vs barrier?</summary>

- **Atomic**: управляет **одновременным доступом** нескольких потоков к **одной ячейке памяти**. Операцию в каждый момент выполняет только один, данные не портятся.
- **Barrier**: **точка синхронизации** work-group. Все должны закончить свою фазу, **прежде чем двигаться дальше**, порядок операций сохраняется.

</details>

<details>
<summary><b>Q:</b> Can a barrier synchronize work-items from different work-groups? How do you get global synchronization?</summary>

**Нет**, barrier действует только **внутри одной work-group**.

Глобальная синхронизация: разбить задачу на **несколько kernel-запусков**. Следующий kernel начинается после завершения всех work-items предыдущего (слайд «Multiple kernels: global (not only workgroup) synchronization»).

</details>

<details>
<summary><b>Q:</b> What's wrong with this kernel?

```c
__kernel void k(__global int *a) {
    if (get_local_id(0) < 16) {
        a[get_global_id(0)] = 0;
        barrier(CLK_GLOBAL_MEM_FENCE);
    }
}
```
</summary>

Barrier находится внутри ветки, которую проходят **не все work-items группы**. Барьер должен быть выполнен **всеми** work-items work-group, иначе undefined behaviour (обычно deadlock или зависание). Барьер нужно вынести из `if`.

</details>

<details>
<summary><b>Q:</b> What are events in OpenCL used for?</summary>

Для синхронизации **команд в command queue**: управление потоком выполнения, гарантия, что одни операции завершились до начала других. Через `event_wait_list` и выходной `event` в `clEnqueue*`.

</details>

<details>
<summary><b>Q:</b> Host code executes sequentially, so why do we need events?</summary>

Команды в очередь только **ставятся** (enqueue выполняется асинхронно). Events нужны, когда используются **несколько command queues**, связанных с **разными devices или contexts**: зависимости между такими очередями сам порядок host-кода не обеспечивает.

</details>

<details>
<summary><b>Q:</b> Describe the "multiple kernels" execution flow.</summary>

Host: `load_problem()` → `kernel()` (execute_kernel на device: kernel_start … kernel_end) → `sync()` (finish) → `get_results()` → затем то же для Kernel 2.

Kernels могут быть одинаковыми или разными, и все вызываются из host-кода CPU.

</details>

<details>
<summary><b>Q:</b> Which functions release OpenCL objects at the end?</summary>

- `clReleaseMemObject(cl_mem)`
- `clReleaseKernel(cl_kernel)`
- `clReleaseProgram(cl_program)`
- `clReleaseCommandQueue(cl_command_queue)`
- `clReleaseContext(cl_context)`

</details>

<details>
<summary><b>Q:</b> How do you find out how much global memory a device has?</summary>

`clGetDeviceInfo(device, CL_DEVICE_GLOBAL_MEM_SIZE, sizeof(cl_ulong), &size, NULL);`

</details>
