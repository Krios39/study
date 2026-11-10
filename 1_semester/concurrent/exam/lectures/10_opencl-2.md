# Лекция 10: OpenCL II

Слайды: GPGPU-Lecture_2.pdf

(Заголовок слайдов: «Introduction of OpenCL and GPU Computing — Lecture 2».)

---

## 1. Kernel и compute kernel

- **Kernel** — программа, которая **дублируется на compute devices**: **множество экземпляров** kernel выполняются параллельно и обрабатывают массив данных.
- Проще говоря, **OpenCL kernel** — код, предназначенный для выполнения на **GPU**.
- **Compute shader в OpenGL** — тоже вид kernel, но он выполняется **внутри 3D graphics pipeline**.
- **Compute kernel в OpenCL** **не является частью** 3D graphics pipeline.

## 2. NDRange и work-items

- **NDRange** задаёт **число work-items** на compute device (N-мерное пространство индексов, N = 1, 2, 3; оси Dimension X/Y/Z).
- Work-items делятся на **work-groups**. Это уровень **software**.
- Work-group делится на **wavefronts**. Это уровень **hardware (AMD)**, размер зависит от железа (HW-specific size). **[доп.]** У NVIDIA аналог — warp (32).
- **Wavefront** — группа work-items, которые выполняются одновременно.

Иерархия: `NDRange ⊃ work-group ⊃ wavefront ⊃ work-item`.

## 3. Thread structure: built-in функции

Каждый work-item может узнать свой **global ID** по каждому измерению:
- `get_global_id(dim)`, `get_global_size(dim)`
- Пример для 2D (матрица): `get_global_id(0) = row`, `get_global_id(1) = column`.

Или свой **ID work-group** и **ID внутри work-group**:
- `get_group_id(dim)`, `get_num_groups(dim)`, `get_local_id(dim)`, `get_local_size(dim)`
- `get_global_size(0) == get_num_groups(0) * get_local_size(0)`

| Function | Description |
|---|---|
| `uint get_work_dim()` | число измерений |
| `get_global_id(uint dim)` | ID текущего work-item, $[0, WI)$ |
| `get_global_size(uint dim)` | общее число work-items $WI$ |
| `get_global_offset(uint dim)` | offset, заданный в `clEnqueueNDRangeKernel` |
| `get_group_id(uint dim)` | ID текущей work-group, $[0, WG)$ |
| `get_local_id(uint dim)` | ID work-item внутри группы, $[0, WI/WG)$ |
| `get_local_size(uint dim)` | work-items в группе $= WI/WG$ |
| `get_num_groups(uint dim)` | число work-groups $WG$ |

**[доп.]** Без offset: `get_global_id(d) = get_group_id(d) * get_local_size(d) + get_local_id(d)`.

## 4. Memory model

```
┌──────────── OpenCL Device ────────────┐
│  Workgroup              Workgroup     │
│  [Private][Private]     [Private][Private]
│  WorkItem WorkItem      WorkItem WorkItem
│  [ Local Memory ]       [ Local Memory ]
│        Global / Constant Memory        │
└───────────────────────────────────────┘
                 ↕
           Host Memory (Host)
```
- **Buffer object** — блок памяти, выделенный OpenCL-программой. Обычно хранит входные и выходные данные work-items.
- **Constant memory** — часть памяти устройства, **read-only** (`__constant`).
- **Global memory** — часть памяти устройства. **Любой work-item может читать и писать любое место.** Объём узнают через `clGetDeviceInfo()` (`CL_DEVICE_GLOBAL_MEM_SIZE`).
- **Host memory** — память хоста, обычно основная RAM компьютера.
- **Local memory** — доступна **всем work-items одной work-group** (`__local`).
- **Private memory** — доступна **только одному work-item**. Квалификатор **`__private`** (локальные переменные kernel private по умолчанию).

| Память | Видимость | Квалификатор |
|---|---|---|
| Host | CPU | — |
| Global | все work-items (все kernels) + host через buffers | `__global` |
| Constant | все work-items, read-only | `__constant` |
| Local | одна work-group | `__local` |
| Private | один work-item | `__private` |

## 5. Synchronization

Одна из самых сложных задач параллельного программирования — управлять **порядком** выполнения потоков. Синхронизация часто означает **serialization**: поток ждёт другой поток или завершения процедуры.

**Два типа синхронизации:**
1. Among **work-items** within a **work-group** (atomics, fences, barriers).
2. Among **command queues** within a **context** (events, несколько kernels).

### 5.1 Atomics
- Обеспечивают memory ordering и синхронизацию **атомарных операций**: пока один поток читает или пишет атомарную переменную, атомарная операция не даёт другому потоку вмешаться.
- Проблемный пример:
  ```c
  // Thread A
  x--;
  // Thread B may change the value of x before the next line is executed.
  if (x > 0) { /* To do */ }
  ```
  Для таких случаев существуют **atomic variables** и atomic-функции. **[доп.]** Например `atomic_inc(&x)`, `atomic_add(&x, v)`, `atomic_dec`, `atomic_cmpxchg`; в OpenCL 2.0 есть `atomic_int` + `atomic_fetch_sub`. Решение примера: `int old = atomic_dec(&x); if (old - 1 > 0) ...`, то есть использовать **возвращённое** значение, а не перечитывать `x`.
- **`atomic_work_item_fence(flags, ...)`** — memory fence. Флаги `CLK_GLOBAL_MEM_FENCE` и `CLK_LOCAL_MEM_FENCE`. Эквивалент старых `mem_fence()`, `read_mem_fence()`, `write_mem_fence()`.

### 5.2 Barrier
- **Barrier**: work-item ждёт, пока **все work-items** (его work-group) дойдут до того же барьера, затем все продолжают.
- `work_group_barrier();`: work-items в work-group должны выполнить его, прежде чем любой поток продолжит.
- `barrier(CLK_LOCAL_MEM_FENCE);` — два флага:
  - `CLK_GLOBAL_MEM_FENCE`: для global memory;
  - `CLK_LOCAL_MEM_FENCE`: для local memory.
- **Разница (по слайду):**
  - `work_group_barrier()` синхронизирует **поток выполнения** (**Execution**) work-items внутри work-group;
  - `barrier(CLK_LOCAL_MEM_FENCE)` синхронизирует **доступ к local memory** (**Memory**) внутри work-group.
  - Авторитетный источник — Khronos man page `barrier.html`. **[доп.]** По спецификации оба делают и execution barrier, и memory fence по указанным флагам. `work_group_barrier` — имя из OpenCL 2.0, `barrier` — из 1.x.
- **[доп.]** Барьер должен встретиться **всем** work-items группы. Барьер внутри ветки `if`, которую проходят не все, — undefined behaviour (обычно deadlock).

### 5.3 Atomic vs Barrier
- **Atomic operations** управляют тем, как несколько процессов **одновременно** обращаются к **одной памяти** и изменяют её. Целостность данных обеспечивается тем, что конкретную операцию в каждый момент выполняет только один.
- **Barrier** — **точка синхронизации** внутри группы процессов (work-group): все заканчивают свою часть, **прежде чем двигаться дальше**. Сохраняется правильный порядок операций.
- **Коротко:** atomics защищают **одновременный доступ к памяти**, barriers задают **порядок/фазы** выполнения внутри группы.

### 5.4 Events
- **Events** синхронизируют **команды в command queue**: управляют потоком выполнения и гарантируют, что определённые операции завершены, прежде чем начнутся следующие.
- *Host-код выполняется последовательно, так зачем events?* Они нужны, когда используются **несколько command queues**, связанных с **разными devices или contexts**.
- **[доп.]** Последние три аргумента `clEnqueue*`: `num_events_in_wait_list, event_wait_list, &event`. Ещё есть `clWaitForEvents`, `clFinish(queue)`, `clFlush(queue)`.

## 6. Multiple kernels

- Kernel (главная функция GPU) **вызывается из host-кода** на CPU.
- Host может запускать **несколько kernels**, с **одинаковой или разной** функциональностью.
- Схема: `load_problem() → kernel() [execute_kernel → device: kernel_start…kernel_end] → sync() [finish] → get_results()`, затем Kernel 2.
- Граница между kernel-запусками даёт **глобальную синхронизацию** (не только внутри workgroup). Barrier синхронизирует лишь work-group, а следующий kernel начинается, когда предыдущий завершён целиком.

## 7. Release the memory

После обработки освобождают объекты, kernels и program:
```c
clReleaseMemObject(bufC);                 // cl_mem
clReleaseKernel(kernel_1);                // cl_kernel
clReleaseProgram(program);                // cl_program
clReleaseCommandQueue(command_queue);     // cl_command_queue
clReleaseContext(context);                // cl_context
```
**[доп.]** Обычно освобождают в порядке, обратном созданию (сначала kernel/buffers, в конце context), предварительно вызвав `clFinish(queue)`.
