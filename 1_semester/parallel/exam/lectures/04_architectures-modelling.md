# Лекция 04: Parallel architectures; Analytical modelling of parallel algorithms

Слайды: lecture-slides.pdf, стр. 57–89 (архитектуры: 57–68; analytical modelling: 69–89)

> Примечание: в слайдах этой части нет network topologies и isoefficiency — темы ограничены перечисленным ниже.

# Часть 1. Parallel computer architectures

## Flynn's taxonomy
Классификация по числу потоков инструкций (instruction streams) и потоков данных (data streams):

| | Single data | Multiple data |
|---|---|---|
| **Single instruction** | SISD | SIMD |
| **Multiple instruction** | MISD | MIMD |

- **SISD** — последовательный (не параллельный) компьютер: за такт один поток инструкций и один поток данных. Примеры: старые mainframes, minicomputers, workstations, ранние ноутбуки.
- **SIMD** — одна управляющая инструкция применяется ко многим элементам данных; каждый processing unit работает со своим элементом. Подходит для задач с высокой регулярностью (graphics/image processing).
  - Две разновидности: **Processor Arrays** (Connection Machine CM-2, MasPar MP-1/MP-2) и **Vector Pipelines** (Cray X-MP, Y-MP, C90, Fujitsu VP, NEC SX-2, Hitachi S820, ETA10). Также **GPUs**.
  - MasPar MP-2: 128×128 = 16384 процессора, по 64 KB памяти, связи N-E-S-W.
- **MISD** — редкая, зависящая от интерпретации концептуальная категория: несколько processing units независимо обрабатывают один поток данных разными потоками инструкций. Пример машины: Carnegie-Mellon C.mmp. Типичные примеры использования: несколько фильтров над одним потоком сенсора; diverse redundant computations для fault tolerance; несколько криптоалгоритмов, пытающихся взломать одно сообщение.
- **MIMD** — каждый процессор может выполнять свой поток инструкций над своими данными; выполнение **asynchronous, nondeterministic**. Самый распространённый тип: большинство суперкомпьютеров, кластеры, SMP, multi-core, multisocket серверы. Обычно MIMD включает SIMD-подкомпоненты.

## Flynn-Johnson refinement of MIMD
Две оси: **memory organisation** (global / distributed) × **communication/synchronization mechanism** (shared variables / message passing).

| | Shared variables | Message passing |
|---|---|---|
| **Global memory** | **GMSV** — shared-memory multiprocessors | **GMMP** — rarely used |
| **Distributed memory** | **DMSV** — distributed shared memory | **DMMP** — distributed-memory multicomputers |

### Shared-memory multiprocessors (GMSV)
- Общее адресное пространство; процессоры работают независимо, но делят одну память; изменения в памяти видны всем.
- Исторически делятся на **UMA** и **NUMA** по времени доступа.
- **UMA (Uniform Memory Access)**: одинаковые процессоры, равный доступ и одинаковое время доступа к памяти; иначе **CC-UMA** (Cache Coherent UMA). (Обычно = SMP.)
  - **Cache coherence**: hardware поддерживает согласованность кэшированных копий каждой ячейки, но **когда** другой поток может безопасно увидеть запись, определяют synchronization и memory model языка. Реализуется на уровне hardware.
- **NUMA (Non-Uniform Memory Access)**: часто физическое соединение двух и более SMP; один SMP может напрямую обращаться к памяти другого; время доступа к разным памятям неодинаково, доступ через link медленнее. С cache coherency — **CC-NUMA**.
- **Плюсы**: global address space — удобная для программиста модель; обмен данными между задачами быстрый и однородный (память близко к CPU).
- **Минусы**: плохая масштабируемость память↔CPU; в cache-coherent системах трафик кэш/память растёт геометрически; программист отвечает за синхронизацию для «корректного» доступа к общей памяти.

### Distributed memory (DMMP)
- Процессоры в сети, у каждого своя private memory; **нет глобального адресного пространства**; процессоры независимы; связь через **message passing** (явные операции коммуникации).
- **Плюсы**: память масштабируется с числом процессоров; нет overhead при доступе к локальной памяти (нет cache coherence); можно использовать off-the-shelf компоненты.
- **Минусы**: коммуникацию организует программист; отображение структур данных на систему может быть сложным; latency и bandwidth зависят от размера сообщения, топологии, contention и размещения.

### Hybrid distributed-shared memory
- Каждый узел — shared-memory машина (память разделяется между CPU и GPU); узлы соединены как distributed-memory система; между узлами нужна сетевая коммуникация.
- Используется в большинстве high-end систем; по всем признакам останется доминирующей архитектурой.
- **Пример LUMI-G node**: один 64-core AMD EPYC; 512 GiB CPU memory в 4 NUMA domains; 4 пакета MI250X по 2 GPU die; 64 GiB HBM на каждый GPU die; линки CPU-GPU, GPU-GPU, сеть с разной bandwidth; **MPI между узлами, HIP/OpenMP внутри узла**.

## Taxonomy summary (по уровням)
| Уровень | Пример | Классификация |
|---|---|---|
| Scalar thread | один поток инструкций | SISD-like |
| Vector instruction | AVX2, SVE | SIMD |
| GPU warp/wavefront | CUDA/HIP threads группами | **SIMT** over SIMD hardware |
| CPU node | ядра с общим address space | MIMD shared memory |
| Cluster | узлы с раздельной памятью | MIMD distributed memory |
| LUMI | всё вложено | Hybrid |

## Processing in and near memory (PIM)
- Мотивация: перенос данных может стоить больше времени и энергии, чем сама арифметика.
- Идея: перенести избранные операции ближе к данным.
- Кандидаты: **bandwidth-bound** операции с большим data parallelism.
- Плюсы: меньше off-chip трафика, больше внутренняя bandwidth памяти.
- Проблемы: ограниченный набор операций, data placement, programmability, coherence, portability.
- Примеры: Samsung **HBM-PIM**, **UPMEM** (RISC-V-based units внутри DRAM).
- Вопрос: PIM — новая категория Flynn или другое архитектурное измерение? (Скорее другое измерение: где выполняются вычисления относительно данных, а не число потоков инструкций/данных.)

# Часть 2. Analytical modelling of parallel systems
(По Grama, Gupta, Karypis, Kumar, *Introduction to Parallel Computing*, 2003.)

## Основы
- Последовательный алгоритм оценивается asymptotic runtime $T(n)$:
  - $T(n) = O(f(n))$, если $\exists c, n_0 > 0: T(n) \le c f(n)\ \forall n \ge n_0$;
  - $T(n) = \Omega(f(n))$, если $T(n) \ge c f(n)\ \forall n \ge n_0$;
  - $T(n) = \Theta(f(n))$, если $T(n) = O(f(n))$ и $T(n) = \Omega(f(n))$.
  - Асимптотика не зависит от платформы («с точностью до константы»).
- Параллельный алгоритм оценивается как функция от: размера входа, числа процессоров, коммуникационных параметров машины ⇒ анализировать нужно **в контексте платформы**.
- **Parallel system** = параллельный алгоритм + платформа.
- **Wall clock time** — время от старта первого процессора до остановки последнего.
- Вопросы: с какой serial-версией сравнивать? (нельзя брать субоптимальную, чтобы приукрасить параллельную); raw FLOP count бесполезен, если не решает задачу.

## Sources of overhead
Два процессора ≠ вдвое быстрее, из-за:
- **Communication and synchronization** — процессоры должны «разговаривать».
- **Dependencies**: создание/планирование задач, contention, cache coherence / **false sharing**, serial sections.
- **Idling**: из-за load imbalance, синхронизации, последовательных частей.
- **Load imbalance** — из-за алгоритма или системы.
- **Excess computation** — вычисления, которых нет в serial-версии (алгоритм трудно распараллелить или вычисления дублируются, чтобы уменьшить коммуникацию).

## Performance metrics
- **Execution time**: serial $T_S$ — от начала до конца на одном компьютере; parallel $T_P$ — от старта на первом до окончания на последнем.
- $T_{all} = p\,T_P$ — суммарное время всех processing elements.
- **Total overhead** (overhead function): $T_o = p\,T_P - T_S$ — суммарное время на «не полезную» работу.
- **Speedup**: $S = \dfrac{T_S}{T_P}$ — отношение времени на одном процессоре ко времени на $p$ одинаковых processing elements. Проверка speedup при **фиксированном размере задачи** = **STRONG SCALING TEST**.
- **Baseline**: всегда брать **лучшую последовательную программу** $T_{best}(n)$.
  - Пример: bubble sort serial 52 с, odd-even sort parallel 14 с ⇒ «relative speedup» 52/14 = 3.71. Но serial quicksort — 12 с ⇒ честный speedup 12/14 = **0.86**.

### Пример: сложение n чисел на n процессорах
- Частичные суммы поднимаются по логическому бинарному дереву: $\log n$ шагов (для $n=16$ — 4 шага).
- Сложение — $t_c$, передача слова — $t_s + t_w$ ⇒ $T_P = \Theta(\log n)$, $T_S = \Theta(n)$ ⇒ $S = \Theta(n/\log n)$.
- Конкретно $n=p=16$, бесплатная коммуникация: $T_s = 15t_a$, $T_p = 4t_a$ ⇒ $S = 15/4 = 3.75$, $E = 3.75/16 \approx 0.234$.
- Асимптотически $E = \Theta(1/\log n)$.

### Speedup bounds
- Минимум — **0** (параллельная программа никогда не завершается).
- Теоретически $S \le p$.
- $S > p$ возможно, только если каждый PE тратит меньше $T_S/p$; тогда один процессор мог бы эмулировать их по очереди (time-slicing) и получить более быструю serial-программу — противоречие с выбором лучшего serial baseline.

### Superlinear speedup ($S > p$) — откуда берётся на практике
1. **Параллельная версия делает меньше работы**: поиск узла в неструктурированном дереве DFS на 2 PE — PE0 ищет в левом, PE1 в правом поддереве; находят решение, раскрыв лишь часть узлов, а serial DFS обходит почти всё дерево.
2. **Resource-based superlinearity**: больший суммарный cache/memory bandwidth ⇒ выше cache hit ratio.
   - Пример: 1 процессор, 64 KB cache — hit ratio 80%. На 2 процессорах — 90% hit, 8% local memory, 2% remote.
   - Cache 2 ns, DRAM 100 ns, remote 400 ns.
   - 1 PE: $0.8\cdot2 + 0.2\cdot100 = 21.6$ ns/доступ. 2 PE: $0.9\cdot2 + 0.08\cdot100 + 0.02\cdot400 = 17.8$ ns.
   - Speedup $= 2\cdot21.6/17.8 \approx$ **2.43** > 2.

### Efficiency
- Strong-scaling efficiency — доля достигнутого speedup от идеального $p$-кратного:
  $$E_p(N) = \frac{S_p(N)}{p} = \frac{T_1(N)}{p\,T_p(N)}$$
- В обычной work-preserving модели $0 < E \le 1$.
- Измеренное $E > 1$ возможно: cache effects, больший суммарный memory bandwidth, reduced work, слабый baseline.
- Могут ли все ядра показывать 100% utilisation при плохой эффективности? **Да** — ядра могут busy-wait, пересчитывать, конкурировать (contention) или выполнять overhead.

## Amdahl's law (fixed workload)
- $\sigma$ — доля **последовательной** части (от reference execution time), $0 \le \sigma \le 1$:
  $$T_p = T_s\left(\sigma + \frac{1-\sigma}{p}\right) + T_{overhead}(p)$$
- При оптимальном распараллеливании остатка $1-\sigma$ и нулевом overhead:
  $$S(N,P) = \frac{1}{\sigma + \frac{1-\sigma}{p}} \le \frac{1}{\sigma}$$
- Пример 1: $\sigma = 0.67$ (33% параллелизуемо), $P = 10$: $S = \frac{1}{0.67 + 0.33/10} = 1.42$.
- Пример 2: $\sigma = 0.05$:

| P | max S | max E |
|---|---|---|
| 2 | 1.9 | 95% |
| 4 | 3.5 | 87% |
| 10 | 6.9 | 69% |
| 20 | 10.3 | 51% |
| 100 | 16.8 | 17% |
| ∞ | 20 | → 0 |

- График Amdahl: при parallel portion 50/75/90/95% speedup насыщается на 2/4/10/20.

## Gustafson-Barsis' law (scaled workload)
- Gustafson & Barsis (Sandia), 1988, «Reevaluating Amdahl's Law»: на 1024-процессорном nCUBE 10 получили scaled speedup ≈ 1016…1020 при $\sigma \approx 0.004…0.008$ (по Amdahl было бы лишь 125…250).
- **Scaled speedup**:
  $$S_G(p) = \sigma + p(1-\sigma) = p - (p-1)\sigma$$
  (здесь $\sigma$ — доля последовательной части во времени параллельного выполнения).
- Почему это не противоречит Amdahl: математически Amdahl верен, но в общем случае $\sigma = \sigma(N) \ne const$ — **обычно $\sigma$ уменьшается с ростом N**.
- **Amdahl**: как быстро решить **ту же** задачу. **Gustafson**: насколько **большую** задачу можно решить примерно за то же время.
- Алгоритм **effectively parallel**, если $\sigma \to 0$ при $N \to \infty$.

## Scaled efficiency — WEAK SCALING TEST
$$E_S(N,P) := \frac{t_{seq}(N)}{t_{par}(P\cdot N, P)}$$
- Размер задачи растёт пропорционально числу процессоров — остаётся ли время тем же?
- $0 < E_S \le 1$; если $E_S = 1$ — linear (scaled) speedup.
- Weak-scaling efficiency: $E_{weak}(p) = \dfrac{T(N_0, 1)}{T(N(p), p)}$, где $N(p)$ выбирается так, чтобы каждому процессору досталось примерно одинаково работы.
- Идеальное weak scaling — **постоянное время**, а не автоматически «linear speedup».

## Methods to increase efficiency
- Факторы: communication time, waiting time, additional computations, изменение/улучшение алгоритма.
- **Overlapping communication and computations**: пример — параллельный Ax для sparse матриц в domain decomposition: начать non-blocking коммуникацию, считать внутренние части области ⇒ экономия на ожидании.
- **Extra computations instead of communication**: считать на месте, а не получать по сети. Пример: random numbers — broadcast только **seed**, генерировать параллельно детерминированным алгоритмом.
- Profiling tools: MPE (jumpshot), LMPI, mpiP; Valgrind, TotalView, Vampir, Allinea OPT, HPCToolkit, OpenSpeedShop, Paraver+Extrae; Linux gprof (флаг `-pg`); SUN prof/gprof/prism.

## Cost of a parallel algorithm
- **Cost** $= p \times T_P$ — сумма времени, которое каждый PE тратит на задачу. Синонимы: **work**, **processor-time product**.
- **Cost-optimal**: cost на параллельной машине асимптотически равен serial cost: $p\,T_P = \Theta(T_S)$.
- Поскольку $E = T_S/(p\,T_P)$, для cost-optimal систем $E = \Theta(1)$.
- **Пример**: сложение n чисел, $p = n$: $T_P = \log n$, cost $= n\log n$, а $T_S = \Theta(n)$ ⇒ **не cost-optimal**.
- **Исправление**: каждый процессор сначала суммирует свой локальный блок, затем tree reduction:
  $$T_p(n,p) = \Theta\!\left(\frac{n}{p} + \log p\right)$$
  При $p = \Theta(n/\log n)$: $T_p = \Theta(\log n)$ и $p\,T_p = \Theta(n)$ — логарифмическое время и cost-optimality.
