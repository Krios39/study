# Лекция 10: Computer Benchmarks; Parallel programming models and languages

Слайды: lecture-slides.pdf, стр. 176–195 (benchmarks: 176–183; programming models: 184–195)

# Часть 1. Computer benchmarks

## Обзор и эволюция
- HPC benchmarks: **HPL** (High Performance Linpack), **NPB** (NAS Parallel Benchmarks), **HINT** (Hierarchical INTegration), Perf, **IOzone**.
- Эволюция: 1990s — HPL, NPB; 2000s — HPCG, Graph500; 2010s — Green500, IOzone; 2020s — HPL-AI, MLPerf HPC, IO500.
- Причина эволюции: нужно учитывать **mixed precision, AI workloads, data movement и energy efficiency**.

## Linpack / HPL
- **Jack Dongarra**. HPL — High Performance Linpack на **MPI и BLAS**: решение систем линейных уравнений с **dense** matrices.
- Цель: задача максимального размера (рекомендуется использовать ~**80% памяти**).
- Используется для **TOP500**.
- Параметры/результаты:
  - **Rpeak** — пиковая (теоретическая) производительность, Gflops;
  - **Rmax** — максимальная достигнутая производительность, Gflops;
  - **N** — размер матрицы, дающий пиковую производительность (обычно < 80% памяти);
  - **NB** — blocksize; в целом чем меньше, тем лучше, но обычно 32…256.

## Green500 (energy efficiency)
- Измеряет энергоэффективность HPC-систем; метрика **GFLOPS/Watt**; дополняет TOP500.
- Пример 2024: Frontier (Oak Ridge) ~62 GFLOPS/Watt.

## HPCG (High Performance Conjugate Gradient)
- Введён Dongarra et al. для дополнения HPL — нагружает **память и коммуникацию**.
- **Sparse** matrix computations, **memory-bound** performance.
- Лучше отражает реальные научные нагрузки, чем dense HPL; публикуется вместе с HPL в TOP500 и Green500.

## IO500
- С 2017; оценка **I/O и storage** производительности HPC; объединяет тесты **bandwidth** и **metadata**.
- Критичен для data-intensive и checkpoint-heavy приложений.

## Graph500 и MLPerf HPC
- **Graph500**: производительность на больших графах (**BFS, SSSP**); тестирует **irregular memory access** и communication patterns.
- **MLPerf HPC**: AI/deep learning нагрузки на HPC (training и inference); организует **MLCommons**.

## HPL-MxP (HPL-AI)
- Расширяет HPL на **mixed precision** (FP16/FP32): вычисления в низкой точности + **iterative refinement до FP64 accuracy**.
- Используется в TOP500 для AI-accelerated суперкомпьютеров; актуален для GPU, TPU, AI accelerators.

## Benchmarks summary
| Benchmark | Focus | Precision | Type | Year | Example use |
|---|---|---|---|---|---|
| HPL | Dense linear algebra | FP64 | Compute-bound | 1999 | TOP500 |
| Green500 | Power efficiency | N/A | Energy | 2005 | Eco efficiency |
| Graph500 | BFS / graph traversal | Integer | Irregular | 2010 | Data-intensive HPC |
| HPCG | Sparse linear algebra | FP64 | Memory-bound | 2013 | Complement to HPL |
| IO500 | File I/O | N/A | Storage | 2017 | Storage ranking |
| HPL-AI | Dense, mixed precision | FP16/FP32/FP64 | Mixed | 2019 | AI-accelerated HPC |
| MLPerf HPC | Deep learning | Mixed | AI | 2021 | ML system ranking |

# Часть 2. Parallel programming models and languages

## Упрощённая классификация: как структурированы вычисления?
- **Organized by data**: linear → **Geometric Decomposition**; recursive → **Recursive Data**.
- **Organized by tasks**: linear → **Task Parallelism**; recursive → **Divide and Conquer**.
- **Organized by data flow**: regular → **Pipeline**; irregular → **Event-based Coordination**.

## Модели и языки (обзор)
- **Message-passing**: MPI, PVM.
- **Shared memory model**: PRAM.
- **Multi-threaded**: OpenMP, Clojure.
- **PGAS** (Partitioned Global Address Space): High Performance Fortran (HPF), Fortran coarrays.
- **Object-oriented**: Charm++, Smalltalk.
- **MapReduce**: persistent storage (batch processing) — Hadoop; Spark (stream processing) — Resilient Distributed Datasets.
- **Coordination languages**: Linda.
- **GPU languages**: CUDA, OpenCL, OpenACC, OpenHMPP (HMPP for Hybrid Multicore Parallel Programming).
- **Distributed**: Sequoia, Bloom.
- **Event-driven and hardware description**: Verilog (HDL для FPGA).
- **Actor model**: Erlang, Elixir, Scala.
- **Dataflow**: SISAL (Streams and Iteration in a Single Assignment Language).
- **CSP-based** (Communicating Sequential Processes): FortranM, Occam.
- **Functional**: Concurrent Haskell.
- **Concurrent languages**: Pargo (parallel Go).

## PRAM (Parallel Random Access Machine) — shared memory model
- $P$ детерминированных RAM-процессоров (von Neumann machines), работают параллельно (синхронно); коммуникация и синхронизация через **shared memory**. В модели $P$ — **неограничено**.
- Варианты по конфликтам доступа:
  - **EREW** — Exclusive Read Exclusive Write;
  - **CREW** — Concurrent Read Exclusive Write;
  - **CRCW** — Concurrent Read Concurrent Write:
    - **common** CRCW — запись успешна, только если все пишут одно и то же значение;
    - **arbitrary** CRCW — успешен произвольный процесс;
    - **priority** CRCW — по заранее заданным приоритетам.
- Источник: J. JáJá, *An Introduction to Parallel Algorithms*, 1992.

## Brent's theorem
- Алгоритм в PRAM-модели — **DAG**: узлы — вычисления, рёбра — зависимости.
- $T_1$ — время на одном процессоре = **число узлов DAG** (вся работа); $T_p$ — на $p$ процессорах; $T_\infty$ — **глубина** DAG (число уровней зависимостей) = время при неограниченном числе процессоров.
- Нижняя граница: $\dfrac{T_1}{p} \le T_p$.
- **Brent's theorem**:
  $$\frac{T_1}{p} \le T_p \le \frac{T_1}{p} + T_\infty$$
- **Доказательство**: на уровне $i$ DAG — $m_i$ операций; $T_1 = \sum_{i=1}^{n} m_i$, $T_\infty = n$. На уровне $i$ процессоры тратят $T_p^i = \lceil m_i/p\rceil \le m_i/p + 1$. Суммируя:
  $$T_p = \sum_{i=1}^{n} T_p^i \le \sum_{i=1}^{n}\left(\frac{m_i}{p} + 1\right) = \frac{T_1}{p} + T_\infty \quad\blacksquare$$
- Пример DAG со слайда: 14 узлов, 4 уровня (1, 2, 5, 6 узлов) ⇒ $T_1 = 14$, $T_\infty = 4$.

## HPF (High Performance Fortran)
- **PGAS** модель, расширение **Fortran90**; **SPMD** (Single Program Multiple Data) — каждый процесс работает со своей частью данных.
- Директивы HPF (как комментарии `!HPF$ <directive>`) указывают, какой процессор получает какую часть данных; concurrency определяется директивами на основе Fortran90.
- **Owner computes rule** («owner calculates») — вычисление выполняет процессор, владеющий результирующими данными.
- Пример matmul:
  - `!HPF$ PROCESSORS square(2,2)`
  - `!HPF$ DISTRIBUTE (BLOCK,BLOCK) ONTO square :: C`
  - `!HPF$ ALIGN A(i,*) WITH C(i,*)` — реплицировать строки A на процессоры, вычисляющие C(i,j);
  - `!HPF$ ALIGN B(*,j) WITH C(*,j)` — реплицировать столбцы B;
  - тогда `C(i,j) = DOT_PRODUCT(A(i,:), B(:,j))` — вся работа локальна.
- Баланс concurrency и communication: больше процессов ⇒ больше коммуникации; data locality.
- **Легко написать программу, но трудно добиться хорошей efficiency.**
- Методика: (1) написать корректную serial-программу, протестировать; (2) добавить distribution directives, вводя как можно меньше коммуникации.

## Fortran coarrays
- Стандарт **Fortran 2008** (опубликован 2010), развит в Fortran 2018; **PGAS** модель.
- Коммуникации **one-sided**: удалённое обращение image A к image B не требует соответствующего вызова в image B.
- Проще программировать, чем MPI; есть synchronization intrinsics; стандарт-совместимая программа **не должна deadlock-ать или иметь race conditions**.
- Любую обычную переменную можно сделать coarray (скаляры, массивы, intrinsic/derived types, pointers, allocatables).
- Синтаксис: `array( )` — обычный индекс, `coarray[ ]` — **codimension** (номер image).
  - `integer :: i[*]`; `real :: r(3,8)[4,*]`
  - `i[5] = i` — remote write; `r(:,:) = r(:,:)[3,3]` — remote read; `i = j` — локально.
  - Allocatable: `real, allocatable :: r(:)[:]`.
- `do concurrent` — конструкция для параллельных итераций (например, центральная разность `dfdx(i) = (f(i+1)-f(i-1))/(2*dx)`).
- Функциональный параллелизм: отдельные задачи разным images; **teams of images**.

## Message passing model (MPI)
**Когда использовать MPI:**
- нужны **portability и performance**;
- **irregular data structures**;
- создание инструментов/**libraries** для других;
- нужно управлять памятью **per processor**.

**Когда НЕ использовать MPI:**
- regular computation, которая хорошо ложится на HPF/OpenMP;
- решение (библиотека) уже существует;
- требуется **fault tolerance**;
- **distributed computing** (CORBA, DCOM и т.п.).

## In-class exercise 10
- Выбрать параллельный язык программирования, описать, для каких задач подходит, привести пример кода.
