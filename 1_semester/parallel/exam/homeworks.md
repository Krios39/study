# Домашние задания — сводка

> Связь с лекциями — сопоставление по теме: сами отчёты номера лекций не указывают. Все числа взяты из отчётов (report.html). Где нет чисел — в отчёте их тоже нет.

Машины, которые встречаются в отчётах:
- **laptop** — Intel Core Ultra 7 265U, гибридный CPU (2 P-cores + 8 E-cores + 2 LP E-cores, 14 threads, класс 15 W), Windows 11 / WSL 2 (видно 7 cores × 2 threads).
- **server** `parcomp2026` — VM на AMD EPYC 7742, 64 одинаковых vCPU.

---

## HW 1 — Python, NumPy, OpenBLAS threads, Fibonacci

Отчёт: [../hw1/report.html](../hw1/report.html)
Лекции: 01 intro, 02 motivation/HPC (зачем считать быстро, библиотеки), 03 what is parallel computing.

**Задачи и что сделано**
- Вопрос: почему NumPy быстрее Python lists → contiguous memory, compiled C/Fortran, нет dynamic type checking, SIMD + многопоточный BLAS (OpenBLAS/MKL).
- 1.2.1 Замер времени `time.perf_counter()`: sum до 10^7 ≈ 0.57–0.79 s, разброс между запусками (context switches, cache, фон).
- 1.2.2 NumPy tutorial — впечатления, без измерений.
- 1.2.3/1.2.4 `numpy.dot` при разных `OPENBLAS_NUM_THREADS` (на сервере).
- 1.2.5 Least squares (`np.linalg.lstsq`) для n = 123, 0.000377 s. Bonus — 3D: в коде `lstsq` подгоняет плоскость z = ax + by + c к зашумлённым точкам (в тексте отчёта ошибочно написано «прямая через SVD/PCA»).
- 1.3.1 Fibonacci: recursive vs iterative. 1.3.2 matrix exponentiation (repeated squaring, `power_matrix` через `@`), O(log n) умножений.

**Результаты**
- OpenBLAS: 1 thread 0.689 s → 4 threads 0.198 s (~3.5x) → 16 threads 0.086 s → плато ~0.071 s при 32–512 threads. Причины плато: число физических ядер, memory bandwidth, overhead потоков.
- Fibonacci: при n = 32 recursive делает 7 049 155 вызовов, 1.38 s; iterative 31 шаг, 2.4·10⁻⁵ s → ~58 775x. Recursive O(2^n), iterative O(n), matrix O(log n).

**Что запомнить к экзамену**
- Скорость NumPy — от memory layout (contiguous, cache locality) и вынесения циклов в compiled code + SIMD, а не от «магии Python».
- Thread scaling у BLAS почти линейный до ~4 потоков, дальше упирается в ядра и memory bandwidth (diminishing returns).
- Алгоритм важнее параллелизма: O(2^n) → O(n) → O(log n) даёт выигрыш на порядки, которого не даст никакое число ядер.
- Замеры шумят: нужны повторы и median, monotonic timer (`perf_counter`).

---

## HW 2 — C++ и OpenMP (parallel for, tasks, recursive matmul)

Отчёт: [../hw2/report.html](../hw2/report.html)
Лекции: 03 what is parallel computing (shared memory, threads), 04 architectures (cache, memory hierarchy).

**Задачи и что сделано**
- 2.1 LLNL OpenMP tutorial: fork-join, `shared`/`private`, `schedule(static|dynamic)`, `task`/`taskwait`/`single`, `omp_get_wtime()`. Hello World на 14 потоках — вывод в случайном порядке.
- 2.2 `omp_mm.c`: matmul N = 500 с `#pragma omp parallel for schedule(static, 10)`. Массивы перенесены со stack (1 MB на Windows) в heap (`malloc`), иначе crash.
- 2.3.1 Recursive matmul `matmultr` (делит на квадранты до `GRAIN = 32768` элементов ≈ 256 KB) против naive 3-loop. Заодно исправлен баг в `dabs()` из шаблона.
- 2.3.2 Параллелизация рекурсии через `#pragma omp parallel` + `single` + `task`: 8 подзадач идут двумя раундами по 4 с `taskwait` между ними (иначе data race на квадрантах C).

**Результаты**
- 2.2 (N = 500): p = 2 — 1.96x (98%), p = 4 — 2.75x (69%), p = 6 — 3.24x (54%). Мешают малое время (< 50 ms, overhead потоков/barrier) и доступ к B по столбцам (cache misses, конкуренция за RAM).
- 2.3.1 Recursive vs naive (последовательно): 500 — 1.75x, 1000 — 2.74x, 1500 — 0.96x. Выигрыш чисто от cache blocking; на 1500 размеры не делятся на степени 2 и данные не влезают даже в L3.
- 2.3.2 (N = 1000): tasks 1→6 потоков: 0.327 → 0.095 s, parallel speedup 3.44x (57%); к naive в сумме 9.57x.
- Без `single` каждый поток строит своё дерево рекурсии: задач в 6 раз больше, race на C, неверный результат.

**Что запомнить к экзамену**
- Fork-join модель OpenMP; scoping: переменные цикла `private`, в `task` локальные переменные по умолчанию `firstprivate`.
- `schedule(static)` — нулевой overhead при равной нагрузке; `dynamic` — для неравной, но с синхронизацией.
- Task parallelism для divide-and-conquer: `parallel` + `single` + `task` + `taskwait`; зависимости по записи нужно разводить барьером.
- Cache blocking (рекурсия по блокам) даёт ускорение без параллелизма; locality — первый источник производительности.
- Efficiency падает с ростом p: короткие задачи, overhead, общий memory bandwidth.

---

## HW 3 — NumPy-векторизация LU и введение в MPI (mpi4py)

Отчёт: [../hw3/report.html](../hw3/report.html)
Лекции: 03 what is parallel computing (distributed memory, message passing), 04 architectures & analytical modelling.

**Задачи и что сделано**
- 3.1 LU decomposition: два внутренних цикла заменены на `a[k+1:, k+1:] -= np.outer(a[k+1:, k], a[k, k+1:])`; сравнение pure Python / vectorized / `np.linalg.solve`. Локальные замеры шумели — перемерено на сервере.
- 3.2 Hello World из MPI на 4 и 10 процессах — порядок вывода случайный.
- 3.2.1 `return_3rd` на `comm.send`/`comm.recv` (lowercase, pickle).
- 3.2.2 То же на `comm.isend`/`comm.irecv` + `request.wait()`.
- 3.2.3 NumPy-массивы через `comm.Send`/`comm.Recv` (uppercase, raw buffer). Сначала `send` формы, потом `Recv` в заранее выделенный буфер; срез `data[::3]` нужно `.copy()` — non-contiguous view отправить нельзя.
- 3.2.4 `comm.Barrier()` (вызывать на всех rank, иначе deadlock); отладка `mpirun -n 6 xterm -e ipdb3 ...` через WSLg.
- Bonus: pickle vs raw buffer.

**Результаты**
- LU, n = 500: Python ~10 s → vectorized ~0.1 s (~100x) → `np.linalg.solve` ~0.01 s (ещё ~10x, LAPACK). Асимптотика O(n³) везде одинакова, меняется константа.
- Bonus `Send` vs `send`: 10² эл. — 5.4x, 10⁵ — 1.7x, 10⁷ — 2.4x, 1000×1000 — 3.8x, int 10⁶ — 6.9x в пользу raw buffer.

**Что запомнить к экзамену**
- MPI = отдельные процессы с отдельной памятью; порядок вывода недетерминирован без синхронизации.
- mpi4py: lowercase (`send`, `bcast`…) — любые Python-объекты через pickle; Uppercase (`Send`, `Bcast`…) — contiguous buffers, быстрее.
- Non-blocking `isend`/`irecv` возвращают `Request`; данные готовы/буфер свободен только после `wait()`.
- Barrier — collective, должен быть вызван всеми процессами communicator.
- Векторизация уменьшает константу, а не порядок сложности; готовые библиотеки (BLAS/LAPACK) ещё на порядок быстрее ручного кода.

---

## HW 4 — MPI collectives, matrix-vector, strong scaling

Отчёт: [../hw4/report.html](../hw4/report.html)
Лекции: 04 architectures & analytical modelling (speedup, efficiency, strong scaling), 07 decomposition & mapping (row-block vs row-cyclic).

**Задачи и что сделано**
- 4.1.1 Trapezoidal integration: point-to-point заменён на `Reduce(op=MPI.SUM)` на rank 0; проверка против serial (`np.isclose`, иначе `sys.exit(1)`).
- 4.1.2 Повторное умножение `A^K x`: `Scatter` строк A, `Bcast` x, в цикле `Allgather` нового вектора.
- 4.2 Row-block `Ax_rowblock` с проверкой `P ≤ N`, `N % P == 0`; тест `a4_test.py` при P = 1, 2, 4, 8 (8 — `--oversubscribe`).
- 4.3 Strong scaling: N = 4096 (~134 MB), K = 50, `OMP/OPENBLAS/MKL_NUM_THREADS=1`, WSL с 4 ядрами.
- Bonus: row-cyclic + `Scatterv`/`Allgatherv` для N, не делящегося на P (N = 65, P = 4 → 17/16/16/16 строк).

**Результаты (4.3)**

| P | Kernel, s | Kernel speedup | Efficiency |
|---|---|---|---|
| 1 | 0.300 | 1.00x | 100% |
| 2 | 0.182 | 1.64x | 82% |
| 4 | 0.154 | 1.95x | 49% |
| 8 (oversubscribed) | 0.192 | 1.56x | 20% |

- Плато на P = 4: matrix-vector memory-bound — процессы стоят в очереди к RAM; плюс `Allgather` каждый шаг.
- P = 8 медленнее P = 4: oversubscription → context switches.
- Row-cyclic хуже row-block (P = 4): распределение 0.028 vs 0.015 s (на root нужно упаковать разбросанные строки в contiguous buffer), kernel 0.158 vs 0.154 s (после `Allgatherv` вектор приходится переставлять). Для dense матрицы выгоды балансировки нет; cyclic полезен при неравной стоимости строк (sparse).

**Что запомнить к экзамену**
- Collectives: `Reduce` (сумма на root), `Bcast`, `Scatter`, `Allgather` (собрать и раздать всем); `v`-версии (`Scatterv`, `Allgatherv`) с counts/displacements для неравных кусков.
- Row-block matvec: Scatter A + Bcast x один раз, Allgather каждую итерацию — потому что каждый процесс считает свои готовые элементы y.
- Strong scaling: S(P) = T(1)/T(P), E(P) = S/P; memory-bound задачи быстро выходят на плато.
- Не oversubscribe: процессов больше, чем ядер, — замедление.
- Отключать вложенный параллелизм BLAS (`*_NUM_THREADS=1`), иначе замеры MPI бессмысленны.

---

## HW 5 — Shaders: Mondrian (GLSL) и Gray-Scott на GPU, Web Workers vs GPU

Отчёт: [../hw5/report.html](../hw5/report.html) (живое демо: `../hw5/index.html`)
Лекции: 05 shaders (guest); бонус касается 07 decomposition (strips + halo) и 08 GPGPU.

**Задачи и что сделано** (всё в plain JavaScript + WebGL2, один файл `index.html`; задача B — Godot — не делалась)
- A. Mondrian: композиция как данные (`uRect[N]`, `uCol[N]` uniform arrays), функция `rect(st, pos, size, aa)` на `smoothstep` (anti-aliasing), наложение через `mix()`, flip `st.y`. Три рендера: GLSL, тот же код per-pixel на CPU в JS, pure CSS grid.
- C. Gray-Scott reaction-diffusion (A + 2B → 3B, параметры feed f и kill k; 3×3 Laplacian stencil, explicit Euler). Состояние в RGBA32F texture, ping-pong двух textures через framebuffer (читать и писать одну текстуру нельзя), нужен `EXT_color_buffer_float`, torus boundary.
- Улучшения: parameter map (k по x, f по y), стенки мышью (absorbing / reflecting = zero flux), anisotropic diffusion `0.2(1±a)`, relief rendering.
- Bonus: тот же шаг на CPU (Web Workers, horizontal strips + halo 10 строк, 10 шагов без обмена — temporal blocking) против GPU. Корректность strips проверена `verify_strips.js`: разница ровно 0 для 1, 3, 4, 7 strips.

**Результаты**
- Anisotropy: отношение вертикального к горизонтальному градиенту a = 0 → 0.95–1.07, a = 0.6 → 1.5–1.7, a = −0.6 → 0.63–0.66. При a = 0.8 паттерн разваливается (вертикальный вес 0.04 < диагонального 0.05 — stencil уже не аппроксимирует Laplacian, численный артефакт). Рабочий диапазон |a| ≤ 0.6.
- Bonus (512×512, 100 шагов, median из 5): 1 worker 781 ms; 2 — 1.9x; 4 — 2.7x; 8 — 3.5x (лучший CPU); 14 — 2.8x (хуже!); GPU (integrated Intel) 96 ms = 8.1x к 1 worker.
- GPU vs лучший CPU: 256² — 2.8x, 512² — 2.3x, 1024² — 3.2x; throughput GPU растёт 207 → 333 M cell-updates/s с размером (фиксированная цена draw call амортизируется).
- Почему workers плохо масштабируются: halo — redundant work (8 strips ≈ 30%, 14 strips > 50%), копирование через `postMessage` (нет `SharedArrayBuffer` на `file://`), склейка на одном потоке (Amdahl), неодинаковые ядра.

**Что запомнить к экзамену**
- Fragment shader = функция «координата пикселя → цвет», выполняемая для всех пикселей параллельно (data parallelism).
- GPGPU через графический API: состояние в texture, ping-pong, render-to-texture; нужна float precision.
- Stencil-задачи (каждая клетка зависит от соседей) идеально ложатся на GPU: «каждый пиксель — свой поток».
- CPU domain decomposition: strips + halo (ghost cells); temporal blocking уменьшает частоту обменов ценой redundant computation.
- Amdahl: последовательная часть (нарезка, копирование, склейка) не уменьшается с ростом числа workers.
- Время GPU мерить с синхронизацией (`readPixels`), иначе меряется только постановка команд в очередь.

---

## HW 6 — MPI matrix-vector: row-, column- и 2D cell-block, Allreduce vs Reduce+Bcast

Отчёт: [../hw6/report.html](../hw6/report.html)
Лекции: 07 decomposition & mapping (1D/2D distribution), 04 analytical modelling (strong scaling, memory bandwidth).

**Задачи и что сделано** (laptop, WSL, Open MPI 5.0.10, только uppercase buffer-методы, P = 1, 2, 4 — P = 8 Open MPI не запустил без oversubscribe; 10 runs, median; время = max по rank через `Reduce(op=MPI.MAX)`)
- 6.1 Column-block `Ax_columnblock`: column blocks нельзя напрямую `Scatter` (не contiguous) → rank 0 делает `np.ascontiguousarray(A.T)` и scatter строк Aᵀ. В цикле локальный `z = A_i x_i` (полная длина N, частичная сумма) → `Allreduce(SUM)`, свой сегмент — следующий x. Последняя итерация — `Reduce` на root.
- Тесты `a6_test.py`: 4 реализации × разные матрицы × K = 0…10, все PASS (180/135/180).
- 6.2 Эксперименты: A strong scaling (N = 4096, K = 50), B размер N = 512…4096 (P = 4), C амортизация setup (K = 1…100).
- 6.3 Cell-block (2D): `Create_cart([p, p])`, sub-communicators `row_comm`/`col_comm`; `row_comm.Reduce` суммы на диагональный процесс, затем `col_comm.Bcast` вниз по столбцу; финал — `col_comm.Gather`.
- Bonus 6: `Allreduce` vs `Reduce` + `Bcast`. Bonus 6b: `Reduce_scatter_block` вместо Allreduce в column-block.

**Результаты**
- Strong scaling, P = 4: row-block total 1.43x (E 36%), mult 1.72x (43%); column-block total 1.08x, mult 1.67x. Total у column в 2.6x хуже из-за setup: транспонирование 134 MB = 0.31–0.40 s против 0.02–0.04 s (страйд 32 KB ломает cache и prefetcher).
- Фаза умножения у row и column почти одинакова (0.173 vs 0.182 s). Ограничение — memory bandwidth: 2 flop на 8 байт; P = 1 ≈ 22 GB/s, P = 4 ≈ 39 GB/s (в 4 раза больше ядер — меньше чем в 2 раза больше пропускной способности).
- Cache: скорость чтения матрицы 116 GB/s при N = 512 (2 MB), 69 GB/s при 1024, 37–38 GB/s при 2048/4096.
- Малые N: column на итерацию ~2x медленнее (Allreduce гоняет полный N-вектор, Allgather — N/P).
- Амортизация (N = 2048): доля setup у column 98% при K = 1 → 38% при K = 100, но column так и не обгоняет row.
- Cell-block (P = 4): total 0.247 s vs row 0.223 s — mult такой же, setup дороже, 2 collectives на итерацию.
- Allreduce vs Reduce+Bcast: Allreduce быстрее почти везде — 1.2–2.4x на малых сообщениях (latency, вдвое меньше шагов), 2x при 10⁶ эл. и P = 4 (через root идёт весь вектор → bottleneck); исключение P = 2, 10⁴ эл. — в пределах шума.
- `Reduce_scatter_block`: при N = 512 в 1.7x быстрее Allreduce (почти как row-block), с N ≥ 1024 разницы нет.

**Что запомнить к экзамену**
- Разбили строки → разбит выход → **конкатенация** (`Allgather`). Разбили столбцы → разбита внутренняя сумма → **сложение** (`Allreduce`/`Reduce_scatter`).
- Matrix-vector memory-bound: speedup ограничен общей пропускной способностью памяти, а не числом ядер.
- Setup (распределение, транспонирование) может доминировать; его надо мерить отдельно и смотреть на амортизацию по K.
- 2D distribution: сообщения N/√P и только внутри строки/столбца процессов — выигрывает на больших P в сети (ScaLAPACK), но не на 4 процессах одного узла.
- Allreduce лучше Reduce+Bcast: меньше latency-шагов и bandwidth-optimal алгоритмы (reduce-scatter + allgather, ring) без bottleneck на root.
- Правильные замеры: Barrier + `Wtime`, max по rank, warm-up, повторы, median.

---

## HW 7 — Ring matrix multiplication: blocking vs non-blocking, strong scaling на 64 ядрах

Отчёт: [../hw7/report.html](../hw7/report.html)
Лекции: 07 decomposition & mapping (1D ring, Cannon/SUMMA), 06 design principles (deadlock, overlap), 04 analytical modelling (computation/communication ratio, scaling).

**Задачи и что сделано** (laptop P = 1, 2, 4; server P = 1…64 с `--bind-to core`; setup не входит во время)
- 7.1 `ring_matrix_multiplication`: rank p держит row block A_p (неподвижный) и column block B; на шаге s считает C_{p,q}, q = (p − s) mod P, затем `comm.Sendrecv` — блок B вправо, новый слева. В конце один `Gather` row blocks C.
- 7.2 `ring_matrix_multiplication_nb`: double buffering, `Irecv` в B_next + `Isend` B_current → умножение → `Waitall` → swap.
- 7.3 Strong scaling: N = 512…4096 (сервер — и 8192), 3 метода.
- Bonus A: гоняется A вместо B (C собирается по column blocks, на root нужна перестановка). Bonus B: прямоугольные N×K · K×M (K любое). Bonus C: Cannon и SUMMA — только описание, не реализовано.
- Тесты `a7_test.py`: все PASS на laptop и server (P = 1, 2, 3, 4, 8, 16); blocking и non-blocking дают bitwise identical результат.

**Результаты (server)**
- Efficiency (blocking): N = 4096 — E(4) 92%, E(16) 58%, E(64) 11%; N = 512 — E(4) 58%, E(64) 2%.
- Оптимальное P растёт с N: P = 8 для N = 512/1024, 8–32 для 2048, 16–32 для 4096, 64 для 8192. Max: 575 GFLOP/s при N = 8192, P = 64 (18.6x).
- Superlinear: N = 8192, P = 4 — 5.26x (131%): один rank на 512 MB матрицах хуже по cache/TLB (31 vs ~41 GFLOP/s).
- Overlap (non-blocking): при большом N и P ≤ 8 равны (0–4%); при P = 16–64 non-blocking быстрее на 1–14%, до 20% (N = 4096, P = 32); при P = 64 на N = 4096/8192 медленнее на 2–9% (нет свободного ядра для OS/MPI progress). Выигрыш мал: вычисления на шаге ≫ передачи; rendezvous без progress thread двигается в основном внутри `Waitall`.
- Laptop: почти не масштабируется (P = 4, N = 2048: 1.36–1.49x; N = 1024 — никогда не быстрее 1 процесса), шум до 19% даже на P = 1. Причина: lock-step кольцо идёт со скоростью самого медленного rank, а у laptop только 2 P-cores + троттлинг 15 W. Один core на обеих машинах одинаков (32–44 GFLOP/s).
- Setup на сервере (1–3.6 s для N = 4096, 14–22 s для 8192) больше самого умножения.
- Circulate A на сервере в основном на 2–10% медленнее (до 18%) — последовательная перестановка N² на root.

**Что запомнить к экзамену**
- Ratio computation/communication для кольца = 2N/(P−1): растёт с N, падает с P → у каждого N своё оптимальное P.
- `Sendrecv` избегает deadlock: при наивном `Send`→`Recv` в кольце все стоят в `Send` (rendezvous для больших сообщений); баг проявляется только на больших блоках. Альтернативы: чётные/нечётные, non-blocking.
- Overlap через `Isend`/`Irecv` + double buffering: буфер отправки можно только читать до завершения; асинхронный прогресс не гарантирован.
- 1D ring: каждый rank получает ~N² данных независимо от P; Cannon/SUMMA (2D) — ~2N²/√P, падает с P.
- Matrix-matrix compute-bound (O(N) reuse элемента), matrix-vector — memory-bound; поэтому matmul масштабируется до 18.6x, а matvec в HW6 — 1.7x.
- Шумная машина (гибридные ядра, троттлинг) не позволяет видеть эффекты в несколько процентов; нужны одинаковые ядра, pinning, idle machine.

---

## HW 8 — OpenCL matmul на integrated GPU, kernels с local memory, OpenVINO CPU/GPU/NPU

Отчёт: [../hw8/report.html](../hw8/report.html)
Лекции: 08 GPGPU/NPU OpenCL (guest); 02/03 (OpenMP-версии из HW2 как baseline).

**Задачи и что сделано** (laptop: integrated Intel GPU, OpenCL 3.0, 64 compute units, max work-group 1024, 64 KB local memory; float32)
- 8.1 Сравнение: sequential C++ (i-k-j, AVX2 auto-vectorization), OpenMP `parallel for` (14 потоков), OpenMP tasks из HW 2.3.2, OpenCL `matmul_tiled` — 2D NDRange, work-group 16×16, тайлы A и B в `__local`, `barrier`; каждый элемент читается из global N/16 раз вместо N. Host выбирает первый GPU среди всех platforms, `-DTS=16`, build log, profiling events (kernel time отдельно от total).
- 8.2 Два kernel'а, 1D NDRange N²: `kernel_A` — всё из global memory, `local_item_size = 2`; `kernel_B` — L work-items одной строки C грузят строку A кусками в `__local`, чтение B coalesced, L = 8/32/64 для N = 1024/2048/4096 (local buffer через `clSetKernelArg(..., L*sizeof(float), NULL)`).
- Bonus: OpenVINO MatMul 2048×2048 на CPU, GPU (f16 по умолчанию и forced f32), NPU (только f16). Собрано MSVC.
- Корректность: все версии 8.1 bitwise совпали с sequential (одинаковый порядок суммирования по k); 8.2 сверка с double (rel. error ~10⁻⁶).

**Результаты**

| N | Sequential | OpenMP for | OpenMP tasks | OpenCL total | OpenCL kernel |
|---|---|---|---|---|---|
| 512 | 0.024 s | 0.40x | 0.04x | 6.9x | 9.8x |
| 2048 | 5.33 s | 1.80x | 0.98x | 16.6x | 20.6x |
| 4096 | 44.8 s | 2.17x | 1.11x | 19.0x | 22.4x |

- Tiled kernel стабильно 67–69 GFLOP/s (107 при N = 512 — всё в cache). Transfers при N ≥ 2048 — 15–20% total.
- CPU memory-bound: sequential 11 GFLOP/s при N = 512 → 3–4 при больших N; OpenMP for лишь 1.8–2.2x на 14 потоках; на N = 512 медленнее 1 потока. OpenMP tasks — leaves ~32³, overhead десятков тысяч задач.
- 8.2: kernel_B / kernel_A = 1.6x (1024), 5.1x (2048), 8.8x (4096); A падает 9.8 → 4.4 GFLOP/s, B растёт 15.9 → 38.7. Work-group из 2 занимает SIMD-поток (8–32 lanes) двумя lanes; B заполняет lanes + reuse A + coalesced B. Оба медленнее tiled (тот reuse'ит и A, и B).
- OpenVINO (N = 2048): CPU f32 219.5 GFLOP/s, GPU f32 721, GPU f16 947, NPU f16 1041 GFLOP/s. NPU ≈ GPU f16 в пределах шума, ~4.5x быстрее CPU. Ошибка f16: GPU 6.1e-3, NPU 4.7e-4. Compile GPU/NPU 1.2–1.4 s vs CPU 0.03 s → окупается только при многократных inference. OpenVINO GPU f32 ~11x быстрее моего tiled kernel, OpenVINO CPU 68x быстрее sequential loop.

**Что запомнить к экзамену**
- OpenCL модель: platform → device → context → command queue → program/kernel; NDRange = global size, work-group = local size; memory: global / `__local` / private; `barrier(CLK_LOCAL_MEM_FENCE)` внутри группы.
- Tiling в local memory превращает memory-bound matmul в compute-bound: каждый загруженный элемент используется TS раз.
- Размер work-group критичен: меньше ширины SIMD — простаивающие lanes; coalesced доступ соседних work-items.
- Мерить total (с transfers) и kernel time (profiling events) отдельно; transfers O(N²) против вычислений O(N³).
- Precision (f16 vs f32) — часть сравнения ускорителей; NPU рассчитан на inference.
- Оптимизированные библиотеки (oneDNN/OpenVINO) на порядок быстрее простого кода: register blocking, vector loads, sub-groups.

---

## HW 9 — Manager-worker matmul и DD Schwarz Lab (weak/strong scaling, coarse correction)

Отчёт: [../hw9/report.html](../hw9/report.html)
Лекции: 09 domain decomposition; 07 decomposition & mapping (manager-worker, dynamic load balancing, granularity); 04 (weak vs strong scaling).

**Задачи и что сделано**
- 9.1 `manager_worker_AxB(A, B, m)` (mpi4py, laptop): A и B режутся на m×m блоков, задача = (i, k, j) → блок A_ik·B_kj, m³ задач. Manager: `Probe(ANY_SOURCE, ANY_TAG)` → `status.Get_source()/Get_tag()` → `Recv` от этого rank. Tags REQUEST/TASK/RESULT/STOP. Тесты 25 случаев × P = 2, 3, 4, 7 — 100 PASS.
- 9.2 Weak scaling в DD Schwarz Lab (server, 64 vCPU): 64×64 точек на subdomain, P_x = P_y ∈ {1,2,3,4,6,8} (до 64 ranks), diffusion H = 1, ASM + IC(0), outer CG, halo 2, rtol 1e-8. Три серии: one-level (без coarse), balanced coarse C = 2·P_x (растёт), balanced C = 4 (фиксирован). Гипотеза записана до измерений.
- 9.3 Влияние coarse correction на число итераций (те же данные).
- Bonus A: granularity m при N = 1920 (laptop). Bonus B: strong scaling 256×256, 4×4 subdomains, 1–16 ranks. Bonus C: residual histories, setup vs solve.

**Результаты**
- Итерации 1 → 64 subdomains: one-level 52 → 579 (≈ ∝ P_x), C = 2·P_x 39 → 135 (почти flat с 16 subdomains), C = 4 29 → 356.
- Solve time 1 → 64: one-level 0.190 → 8.95 s (E_weak 0.02), fixed coarse 0.136 → 7.46 s (0.02), growing coarse 0.191 → 2.91 s (0.07). Setup + solve на 64: 4.02 s (growing) vs 9.32 s (one-level) vs 7.87 s (fixed).
- На 64 subdomains growing coarse режет итерации 4.3x, setup + solve 2.3x; fixed C = 4 — только 1.6x по итерациям.
- Неожиданно: стоимость итерации растёт (local time на итерацию 2.80 → 9.68 ms one-level при росте локальной задачи всего на 11% из-за halo). Гипотеза (не измерена): общий memory bandwidth и scheduling VM при 64 активных ranks.
- Bonus B strong scaling (16 ranks): one-level 9.26x (E 0.58), balanced C = 8 8.82x (0.55); итерации не зависят от числа ranks (293 и 122) — декомпозиция фиксирована.
- Bonus A: sweet spot m = 4 при P = 5 (0.266 s), m = 2 при P = 7; m = 64 (262144 задачи) 6–12.6 s и хуже с ростом P. Реального speedup нет: 1 worker с m = 1 — 0.250 s.
- Bonus C: на 1 subdomain coarse (39 vs 52 итераций) всё же медленнее по setup + solve (0.318 vs 0.305 s).

**Что запомнить к экзамену**
- Manager-worker = dynamic load balancing: быстрый worker просто чаще просит работу; manager — единая точка и bottleneck при мелких задачах.
- Granularity: слишком крупно — нечего делить, слишком мелко — сообщения и manager доминируют; оптимум посередине.
- One-level Schwarz (ASM): информация уходит на ~1 subdomain за итерацию → число итераций растёт ~ числу subdomains по стороне; нужна coarse correction, размер которой растёт с числом subdomains.
- Weak scaling: работа на процесс постоянна, идеал — постоянное время; на практике ломают рост итераций и рост стоимости итерации (halo, bandwidth). Strong scaling при фиксированной декомпозиции итерации не меняет.
- Лучшая сходимость ≠ меньшее время: coarse space добавляет setup и работу на итерацию.
- Overlap (halo) делает локальные задачи неравными: угол/край/внутренний subdomain.

---

## Карточки по домашкам

### HW 1

<details>
<summary><b>Q:</b> Почему NumPy-массивы быстрее Python lists?</summary>

Contiguous memory одного типа (cache locality, prefetching) вместо списка указателей на объекты; циклы в compiled C/Fortran без dynamic type checking; SIMD (AVX/SSE) и многопоточный BLAS (OpenBLAS, MKL).

</details>

<details>
<summary><b>Q:</b> Как масштабировался `numpy.dot` по `OPENBLAS_NUM_THREADS` в HW1 и почему вышел на плато?</summary>

1 thread 0.689 s → 4 threads 0.198 s (~3.5x, почти линейно) → 16 threads 0.086 s → плато ~0.071 s до 512 threads. Причины: число физических ядер, насыщение memory bandwidth, overhead управления потоками.

</details>

<details>
<summary><b>Q:</b> Recursive vs iterative vs matrix Fibonacci — сложность и замеры?</summary>

Recursive O(2^n) — при n = 32 около 7 млн вызовов, 1.38 s. Iterative O(n) — 31 шаг, ~2·10⁻⁵ s (~58 775x быстрее). Matrix exponentiation (repeated squaring матрицы [[1,1],[1,0]]) — O(log n) умножений. Мораль: смена алгоритма даёт больше, чем параллелизм.

</details>

### HW 2

<details>
<summary><b>Q:</b> Почему recursive (blocked) matmul быстрее naive 3-loop даже без потоков?</summary>

Одинаковые O(N³) операций, но naive идёт по столбцам B с шагом N·8 байт → cache misses. Рекурсия делит на квадранты до GRAIN = 32768 элементов (~256 KB), блоки живут в L2. Замеры: 1000×1000 — 2.74x; на 1500 выигрыш пропал (0.96x): размеры не степени 2, данные не влезают даже в L3.

</details>

<details>
<summary><b>Q:</b> Как распараллелить recursive matmul через OpenMP tasks без data race?</summary>

`#pragma omp parallel` + `#pragma omp single` вокруг корневого вызова, рекурсивные вызовы — `#pragma omp task`. 8 подпроизведений пишут попарно в один квадрант C → два раунда по 4 независимые задачи с `#pragma omp taskwait` между ними. Локальные переменные в task по умолчанию `firstprivate`.

</details>

<details>
<summary><b>Q:</b> Что будет, если убрать `#pragma omp single` в task-версии?</summary>

Каждый поток запустит корневой вызов и построит своё дерево рекурсии: в P раз больше задач, одновременная запись в одни элементы C → неверный результат и thrashing очереди задач.

</details>

<details>
<summary><b>Q:</b> Почему OpenMP matmul N = 500 дал только 3.24x на 6 потоках (E 54%)?</summary>

Время работы < 50 ms — заметна доля создания потоков и barrier; naive порядок i-j-k читает B по столбцам → cache misses, потоки конкурируют за RAM bandwidth. На 2 потоках было 1.96x (98%).

</details>

### HW 3

<details>
<summary><b>Q:</b> Чем `comm.send` отличается от `comm.Send` в mpi4py и что быстрее?</summary>

lowercase сериализует любой Python-объект через pickle; Uppercase передаёт contiguous buffer (NumPy) напрямую. В бонусе raw buffer был быстрее везде: 1.7x–6.9x (int 10⁶ — 6.9x, 1000×1000 float — 3.8x). Lowercase — для словарей, строк и т.п.

</details>

<details>
<summary><b>Q:</b> Почему нельзя отправить `data[::3]` через `comm.Send` и как исправить?</summary>

Срез с шагом — view с разрывами (non-contiguous stride), а `Send` ждёт непрерывный блок байт. Решение: `data[::3].copy()` — новый плотный массив.

</details>

<details>
<summary><b>Q:</b> Правила использования `comm.Barrier()`?</summary>

Collective: должен быть вызван всеми процессами communicator; внутри `if rank == 0:` — deadlock. Полезен для отладки (упорядочить вывод) и замеров, но в production заставляет быстрые процессы ждать.

</details>

<details>
<summary><b>Q:</b> Что дала векторизация LU в NumPy (n = 500)?</summary>

Pure Python ~10 s → `np.outer`-векторизация ~0.1 s (~100x) → `np.linalg.solve` (LAPACK) ~0.01 s. Сложность везде O(n³), уменьшается только константа.

</details>

### HW 4

<details>
<summary><b>Q:</b> Какие collectives нужны для повторного row-block matrix-vector Aᴷx и почему?</summary>

Один раз: `Scatter` row blocks A, `Bcast` x. Каждую итерацию: `Allgather` — каждый процесс посчитал свои готовые элементы нового вектора, а на следующем шаге всем нужен весь вектор.

</details>

<details>
<summary><b>Q:</b> Strong scaling matvec N = 4096, K = 50 в HW4 — результаты и причины?</summary>

P = 2: 1.64x (82%), P = 4: 1.95x (49%), P = 8 (oversubscribe на 4 ядрах): 1.56x (20%). Плато — memory-bound задача (134 MB матрица, общая шина памяти) + `Allgather`; P = 8 — context switching из-за oversubscription.

</details>

<details>
<summary><b>Q:</b> Когда row-cyclic распределение лучше row-block и почему в HW4 оно проиграло?</summary>

Cyclic выравнивает нагрузку, если строки разной стоимости (sparse). Для dense выигрыша нет, а расходы есть: root упаковывает разбросанные строки в contiguous buffer (распределение 0.028 vs 0.015 s), после `Allgatherv` вектор приходится переставлять (kernel 0.158 vs 0.154 s).

</details>

<details>
<summary><b>Q:</b> Как убрать условие N % P == 0?</summary>

Использовать `Scatterv`/`Allgatherv` с массивами counts и displacements: первые N mod P процессов получают N//P + 1 строк (N = 65, P = 4 → 17, 16, 16, 16).

</details>

### HW 5

<details>
<summary><b>Q:</b> Как сделать GPGPU-симуляцию (Gray-Scott) на fragment shaders WebGL2?</summary>

Состояние — float texture (RGBA32F: A, B, маска стенки). Fragment shader читает текстуру 0 (`texelFetch`), пишет следующий шаг в текстуру 1 через framebuffer, потом swap (ping-pong): читать и писать одну текстуру нельзя (feedback loop). Нужен `EXT_color_buffer_float`, иначе мелкие изменения округляются и паттерн «замирает».

</details>

<details>
<summary><b>Q:</b> CPU Web Workers vs GPU для Gray-Scott 512×512 — результаты?</summary>

1 worker 781 ms; 8 workers 3.5x (лучший CPU); 14 workers 2.8x — хуже; GPU (integrated) 96 ms = 8.1x к 1 worker и 2.3x к лучшему CPU (2.8–3.2x на других размерах). Throughput GPU растёт с размером (207 → 333 M updates/s).

</details>

<details>
<summary><b>Q:</b> Почему Web Workers масштабировались плохо?</summary>

Halo 10 строк + 10 шагов без обмена (temporal blocking) → redundant work (~30% при 8 strips, > 50% при 14); копирование через `postMessage` (нет `SharedArrayBuffer` на `file://`); нарезка/склейка на одном потоке (Amdahl); неодинаковые ядра и фоновая нагрузка.

</details>

<details>
<summary><b>Q:</b> Почему anisotropy a = 0.8 ломает симуляцию?</summary>

Вертикальный вес 0.2·(1 − 0.8) = 0.04 становится меньше диагонального 0.05 — 3×3 stencil больше не аппроксимирует Laplacian, B заливает сетку. Численный артефакт; рабочий диапазон |a| ≤ 0.6 (a = 0.6 даёт отношение градиентов 1.5–1.7, горизонтальные полосы).

</details>

<details>
<summary><b>Q:</b> Как правильно мерить время GPU в WebGL?</summary>

WebGL-вызовы только ставят работу в очередь. Нужно в конце форсировать завершение (1-pixel `readPixels`), иначе таймер измеряет лишь отправку команд.

</details>

### HW 6

<details>
<summary><b>Q:</b> Row-block vs column-block matvec: какая коммуникация между итерациями и почему?</summary>

Row-block: каждый процесс считает свои готовые элементы y → конкатенация, `Allgather`. Column-block: y = Σ A_i x_i, каждый процесс имеет частичную сумму всего вектора → сложение, `Allreduce(SUM)` (последняя итерация — `Reduce`). «Разбили строки — разбит выход; разбили столбцы — разбита внутренняя сумма».

</details>

<details>
<summary><b>Q:</b> Почему column-block в HW6 был в 2.6x медленнее по total при одинаковой фазе умножения?</summary>

Setup: column blocks не contiguous → rank 0 делает `np.ascontiguousarray(A.T)` 134 MB с шагом 32 KB (ломает cache и prefetcher): 0.31–0.40 s против 0.02–0.04 s. Mult при P = 4: 0.173 vs 0.182 s — почти равно.

</details>

<details>
<summary><b>Q:</b> Почему matvec даёт только 1.72x на 4 процессах (HW6)?</summary>

Memory-bound: 2 flop на 8-байтный элемент. Пропускная способность выросла лишь с ~22 GB/s (P = 1) до ~39 GB/s (P = 4) — общий memory controller. Подтверждение: при N = 512 (2 MB, в cache) чтение 116 GB/s, при N ≥ 2048 — 37–38 GB/s.

</details>

<details>
<summary><b>Q:</b> Allreduce vs Reduce + Bcast — что быстрее и почему?</summary>

Allreduce почти всегда: 1.2–2.4x на малых сообщениях (один collective, ~log₂P шагов вместо 2·log₂P), 2x на 10⁶ элементов при P = 4 (bandwidth-optimal: reduce-scatter + allgather / ring, ~2n(P−1)/P на процесс; в Reduce + Bcast весь вектор идёт через root). Алгоритмы и пороги зависят от MPI-библиотеки и железа.

</details>

<details>
<summary><b>Q:</b> Когда полезно 2D (cell-block) распределение и почему в HW6 оно не выиграло?</summary>

В 1D каждый процесс каждую итерацию получает/отдаёт вектор длины N независимо от P; в 2D — N/√P и только внутри строки/столбца из √P процессов (`Create_cart`, `row_comm.Reduce`, `col_comm.Bcast`). Важно при тысячах процессов в сети (ScaLAPACK). На одном узле, P = 4, memory-bound: 0.247 s vs 0.223 s у row-block — дороже setup и 2 collectives на итерацию.

</details>

### HW 7

<details>
<summary><b>Q:</b> Как устроено ring matrix multiplication и почему достаточно одного `Gather` в конце?</summary>

Rank p держит row block A_p и column block B; на шаге s считает C_{p,q}, q = (p − s) mod P, затем `Sendrecv` — B вправо, новый слева. Каждый C_{p,q} вычисляется один раз владельцем строки и сразу окончателен; кольцо гоняет только B. Gather после каждого шага дал бы P раз больше мелких сообщений и лишние синхронизации.

</details>

<details>
<summary><b>Q:</b> Почему наивный `Send` → `Recv` в кольце может зависнуть и как это решить?</summary>

Все сначала вызывают `Send`; большие сообщения идут по rendezvous protocol — `Send` ждёт posted `Recv`, а до `Recv` никто не дошёл → циклическое ожидание. Маленькие проходят через eager buffer, поэтому баг всплывает только на больших N. Решения: `Sendrecv`, порядок по чётности rank, non-blocking `Isend`/`Irecv`.

</details>

<details>
<summary><b>Q:</b> Помог ли overlap (non-blocking) в ring matmul?</summary>

Сервер: при большом N и P ≤ 8 — разница 0–4%; при P = 16–64 non-blocking быстрее на 1–14%, до 20% (N = 4096, P = 32); при P = 64 на N = 4096/8192 медленнее на 2–9% (нет свободного ядра для progress). Выигрыш мал: вычисления ≫ передачи, без progress thread rendezvous двигается в основном в `Waitall`. На laptop шум (10–19% даже при P = 1) не дал измерить.

</details>

<details>
<summary><b>Q:</b> Как отношение вычислений к коммуникации зависит от N и P в 1D ring и что это даёт?</summary>

2N³/P операций на (P−1)N²/P переданных элементов → 2N/(P−1). Растёт с N, падает с P → у каждого N оптимальное P (сервер: P = 8 для N = 512, 16–32 для 4096, 64 для 8192). N = 512, P = 64: 16 оп/элемент, speedup ~1.3x; N = 8192, P = 64: 260, speedup 18.6x (575 GFLOP/s).

</details>

<details>
<summary><b>Q:</b> Почему сервер масштабировал ring matmul (P = 4, N = 2048: 3.43x), а laptop — нет (1.36–1.49x)?</summary>

Один core одинаков на обеих машинах (32–44 GFLOP/s). Кольцо lock-step — идёт со скоростью медленнейшего rank. Laptop: 2 P-cores, остальные — E-cores, 15 W троттлинг при нагрузке. Сервер: одинаковые vCPU, `--bind-to core`, idle.

</details>

<details>
<summary><b>Q:</b> Чем Cannon/SUMMA лучше 1D ring по коммуникации?</summary>

В 1D ring каждый rank получает ~N² элементов (всю B) независимо от P. В 2D (√P×√P) — ~2N²/√P, падает с P, только между соседями (Cannon: initial skew + сдвиги A влево, B вверх; SUMMA: broadcast панелей по строкам и столбцам, основа PDGEMM). При P = 4 выигрыша нет (2N²/2 = N²).

</details>

### HW 8

<details>
<summary><b>Q:</b> Как работает tiled OpenCL matmul kernel и что он даёт?</summary>

2D NDRange, work-item на элемент C, work-group 16×16. Группа грузит тайл A и тайл B 16×16 в `__local`, `barrier`, каждый work-item суммирует 16 произведений из local memory, затем следующие тайлы. Каждый элемент читается из global N/16 раз вместо N. В HW8: 67–69 GFLOP/s, N = 4096 — 2.35 s total против 44.8 s sequential (19x) и 20.6 s OpenMP (~9x).

</details>

<details>
<summary><b>Q:</b> Почему kernel_B был до 8.8x быстрее kernel_A?</summary>

kernel_A: work-group из 2 → SIMD-поток (8–32 lanes) заполнен на 2 lanes, все чтения из global без reuse; падает 9.8 → 4.4 GFLOP/s с ростом N. kernel_B: L = 8–64, строка A грузится в `__local` один раз на группу, чтение B coalesced → 15.9 → 38.7 GFLOP/s. Эффекты смешаны: и размер группы, и local memory.

</details>

<details>
<summary><b>Q:</b> Почему CPU-версии matmul в HW8 упёрлись в 3–7 GFLOP/s?</summary>

Memory-bound: для каждой строки C матрица B заново читается из RAM (11 GFLOP/s только при N = 512, когда B в cache). OpenMP for на 14 потоках — 1.8–2.2x (общий memory interface), на N = 512 медленнее 1 потока. OpenMP tasks: leaves ~32³ и десятки тысяч задач — overhead побеждает.

</details>

<details>
<summary><b>Q:</b> OpenVINO MatMul 2048² на CPU/GPU/NPU — что показали замеры?</summary>

CPU f32 219.5 GFLOP/s; GPU f32 721; GPU f16 (по умолчанию!) 947; NPU f16 1041. NPU ≈ GPU f16, ~4.5x быстрее CPU. Ошибка f16: GPU 6.1e-3, NPU 4.7e-4. Compile 1.2–1.4 s на GPU/NPU — окупается только при многократном inference. OpenVINO GPU f32 ~11x быстрее своего tiled kernel.

</details>

<details>
<summary><b>Q:</b> Зачем в OpenCL мерить отдельно total и kernel time?</summary>

Total = allocation + write A, B + kernel + read C; kernel — по profiling events на device. Transfers O(N²) против вычислений O(N³): при N ≥ 2048 они 15–20% total, при малых N могут доминировать. Integrated GPU делит память с CPU, на discrete GPU цена PCIe-transfer выше.

</details>

### HW 9

<details>
<summary><b>Q:</b> Как manager в manager-worker узнаёт, от кого пришло сообщение, и почему результаты не теряются?</summary>

`Probe(source=MPI.ANY_SOURCE, tag=MPI.ANY_TAG, status=status)` → `status.Get_source()`, `Get_tag()` → `Recv` от этого rank. Worker шлёт следующий REQUEST только после отправки RESULT, а STOP — ответ на REQUEST, значит у получившего STOP нет висящих результатов. Порядок сообщений от одного отправителя MPI сохраняет.

</details>

<details>
<summary><b>Q:</b> Как granularity (m блоков) влияла на manager-worker matmul (N = 1920)?</summary>

Задач m³, сообщений 6 на задачу, payload растёт ∝ m. Sweet spot: m = 4 при P = 5 (0.266 s), m = 2 при P = 7. m = 64 (262144 задачи): 6–12.6 s, хуже с ростом P — manager bottleneck. Реального speedup на laptop не было: 1 worker с m = 1 — 0.250 s.

</details>

<details>
<summary><b>Q:</b> Зачем coarse correction в Schwarz (ASM) — что показал weak scaling?</summary>

Без coarse информация распространяется на ~1 subdomain за итерацию: итерации 52 → 579 (1 → 64 subdomains, ≈ ∝ P_x). Coarse, растущий с числом subdomains (C = 2·P_x): 39 → 135, почти flat. Фиксированный C = 4: 29 → 356. На 64 subdomains growing coarse — итерации 4.3x меньше, setup + solve 2.3x (4.02 vs 9.32 s).

</details>

<details>
<summary><b>Q:</b> Почему weak scaling в DD Lab далёк от идеала даже при почти flat итерациях?</summary>

Растёт стоимость итерации: local time 2.80 → 9.68 ms (one-level), growing coarse ~4.4x на итерацию; локальная задача с halo 2 больше на 11% (угол/край/интерьер), появляются 4 соседа. Гипотеза: memory bandwidth и VM scheduling при 64 ranks. Solve 0.191 → 2.91 s (E_weak 0.07) даже с лучшим coarse.

</details>

<details>
<summary><b>Q:</b> Weak vs strong scaling в DD Lab: чем отличаются?</summary>

Strong (256×256, фиксированные 4×4 subdomains, 1–16 ranks): итерации не меняются (293 / 122) — ranks меняют исполнение, не метод; 16 ranks — 9.26x (E 0.58) one-level, 8.82x balanced. Weak дополнительно платит за рост итераций при росте числа subdomains. Лучшая сходимость ≠ меньшее время: на 1 subdomain coarse (39 vs 52 итерации) медленнее по setup + solve (0.318 vs 0.305 s).

</details>
