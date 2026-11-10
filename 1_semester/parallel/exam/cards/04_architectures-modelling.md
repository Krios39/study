# Карточки — Лекция 04: Parallel architectures; Analytical modelling of parallel algorithms

<details>
<summary><b>Q:</b> Нарисуйте Flynn's taxonomy и дайте пример для каждой категории.</summary>

| | Single data | Multiple data |
|---|---|---|
| Single instr. | **SISD** — серийный компьютер (старые mainframes, workstations) | **SIMD** — processor arrays (CM-2, MasPar), vector pipelines (Cray X-MP), GPU |
| Multiple instr. | **MISD** — редкая (C.mmp; фильтры над одним потоком, redundant FT computations) | **MIMD** — кластеры, multi-core, SMP, большинство суперкомпьютеров |

</details>

<details>
<summary><b>Q:</b> Что такое SIMD, для каких задач подходит и какие есть две разновидности?</summary>

Одна инструкция применяется к множеству элементов данных одновременно. Подходит для регулярных задач (graphics/image processing). Разновидности: **Processor Arrays** (Connection Machine CM-2, MasPar MP-1/2) и **Vector Pipelines** (Cray X-MP/Y-MP/C90, NEC SX-2 и др.); также GPU.

</details>

<details>
<summary><b>Q:</b> Охарактеризуйте MIMD.</summary>

Каждый процессор может выполнять свой поток инструкций над своими данными; выполнение **asynchronous и nondeterministic**. Самый распространённый тип (кластеры, multi-core, SMP). Обычно включает SIMD-подкомпоненты.

</details>

<details>
<summary><b>Q:</b> Приведите примеры использования MISD.</summary>

Несколько фильтров над одним потоком сенсора; diverse redundant computations для fault tolerance; несколько криптоалгоритмов, пытающихся взломать одно сообщение. Категория редкая и зависит от интерпретации.

</details>

<details>
<summary><b>Q:</b> Опишите Flynn-Johnson classification of MIMD (GMSV, GMMP, DMSV, DMMP).</summary>

Оси: memory (global / distributed) × communication (shared variables / message passing).
- GMSV — shared-memory multiprocessors
- GMMP — rarely used
- DMSV — distributed shared memory
- DMMP — distributed-memory multicomputers

</details>

<details>
<summary><b>Q:</b> UMA vs NUMA?</summary>

- **UMA**: одинаковые процессоры, равный доступ и равное время доступа ко всей памяти (CC-UMA при cache coherence; обычно SMP).
- **NUMA**: часто связанные SMP; процессор может обращаться к памяти другого SMP, но время доступа неодинаково, через link медленнее. С coherence — **CC-NUMA**.

</details>

<details>
<summary><b>Q:</b> Что гарантирует cache coherence и чего она НЕ гарантирует?</summary>

Hardware поддерживает согласованность кэшированных копий каждой ячейки памяти. Но **когда** другой поток может безопасно увидеть запись, определяется synchronization и memory model языка, а не coherence.

</details>

<details>
<summary><b>Q:</b> Плюсы и минусы shared-memory архитектур.</summary>

+ Global address space — удобно программировать; обмен данными быстрый и однородный.
− Плохая масштабируемость память↔CPU; в cache-coherent системах трафик растёт геометрически; программист отвечает за синхронизацию.

</details>

<details>
<summary><b>Q:</b> Плюсы и минусы distributed-memory архитектур.</summary>

+ Память масштабируется с числом процессоров; нет overhead на доступ к локальной памяти; off-the-shelf компоненты.
− Коммуникацию организует программист; сложно отобразить структуры данных; latency/bandwidth зависят от размера сообщения, topology, contention, placement.

</details>

<details>
<summary><b>Q:</b> Что такое hybrid distributed-shared memory? Пример.</summary>

Узлы — shared-memory машины (CPU+GPU), соединённые сетью как distributed-memory система. Доминирующая архитектура high-end систем. Пример LUMI-G node: 64-core AMD EPYC, 512 GiB в 4 NUMA domains, 4×MI250X (8 GPU die, 64 GiB HBM каждый); MPI между узлами, HIP/OpenMP внутри.

</details>

<details>
<summary><b>Q:</b> Как классифицировать GPU warp/wavefront, vector instruction, CPU node, cluster?</summary>

Vector instruction (AVX2, SVE) — SIMD; GPU warp — **SIMT over SIMD hardware**; CPU node — MIMD shared memory; cluster — MIMD distributed memory; LUMI — hybrid.

</details>

<details>
<summary><b>Q:</b> Что такое Processing-in-Memory (PIM)? Плюсы, проблемы, примеры.</summary>

Перенос части операций ближе к данным, потому что перемещение данных дороже арифметики. Подходит для bandwidth-bound data-parallel операций. + меньше off-chip traffic, выше внутренняя bandwidth. − ограниченные операции, data placement, programmability, coherence, portability. Примеры: Samsung HBM-PIM, UPMEM.

</details>

<details>
<summary><b>Q:</b> Что такое parallel system и wall clock time?</summary>

Parallel system = параллельный алгоритм + платформа. Wall clock time — от старта первого процессора до окончания последнего.

</details>

<details>
<summary><b>Q:</b> Назовите источники overhead в параллельных программах.</summary>

Communication и synchronization; dependencies (task creation/scheduling, contention, cache coherence/false sharing, serial sections); idling (load imbalance, sync, serial parts); load imbalance; excess computation (дублирование работы, которой нет в serial-версии).

</details>

<details>
<summary><b>Q:</b> Дайте определения speedup и total overhead.</summary>

$S = T_S / T_P$ — отношение времени лучшего последовательного решения ко времени на $p$ одинаковых PE.
$T_o = p\,T_P - T_S$ — суммарное время всех процессоров на «бесполезную» работу.

</details>

<details>
<summary><b>Q:</b> Strong scaling vs weak scaling test?</summary>

- **Strong**: фиксированный размер задачи, растёт $p$; метрика — speedup $S=T_S/T_P$ и $E = S/p$.
- **Weak**: размер задачи растёт пропорционально $p$; метрика — scaled efficiency $E_S = t_{seq}(N)/t_{par}(PN,P)$; идеал — постоянное время.

</details>

<details>
<summary><b>Q:</b> Bubble sort serial 52 с, odd-even parallel 14 с, quicksort serial 12 с. Каков честный speedup?</summary>

Baseline — лучший serial алгоритм: $S = 12/14 \approx$ **0.86** (а не 52/14 = 3.71 — это лишь relative speedup).

</details>

<details>
<summary><b>Q:</b> Сложение n чисел на n процессорах деревом: $T_P$, $S$, $E$ асимптотически?</summary>

$T_P = \Theta(\log n)$, $T_S = \Theta(n)$, $S = \Theta(n/\log n)$, $E = \Theta(1/\log n)$.

</details>

<details>
<summary><b>Q:</b> Посчитайте S и E для сложения 16 чисел на 16 PE (коммуникация бесплатна).</summary>

$T_s = 15t_a$, $T_p = 4t_a$ (4 уровня дерева) ⇒ $S = 3.75$, $E = 3.75/16 \approx 0.234$.

</details>

<details>
<summary><b>Q:</b> Почему теоретически $S \le p$?</summary>

Если $S > p$, то каждый PE тратит меньше $T_S/p$; тогда один процессор мог бы по очереди (time-slicing) эмулировать $p$ процессоров и получить serial-программу быстрее $T_S$ — противоречие с выбором лучшего serial baseline. Минимум speedup — 0 (программа не завершается).

</details>

<details>
<summary><b>Q:</b> Назовите две причины superlinear speedup с примерами.</summary>

1. Параллельная версия делает меньше работы (DFS-поиск в дереве на 2 PE находит узел, раскрыв меньше узлов).
2. Resource-based: больше суммарный cache/memory bandwidth ⇒ выше hit ratio.

</details>

<details>
<summary><b>Q:</b> Hit ratio 80% на 1 PE; на 2 PE — 90% cache, 8% local, 2% remote. Cache 2 ns, DRAM 100 ns, remote 400 ns. Speedup?</summary>

1 PE: $0.8\cdot2 + 0.2\cdot100 = 21.6$ ns. 2 PE: $0.9\cdot2 + 0.08\cdot100 + 0.02\cdot400 = 17.8$ ns.
$S = 2\cdot21.6/17.8 \approx$ **2.43** (superlinear).

</details>

<details>
<summary><b>Q:</b> Формула efficiency, её границы, и когда измеренная $E > 1$?</summary>

$E_p = S_p/p = T_1/(p\,T_p)$. В work-preserving модели $0 < E \le 1$. $E > 1$ возможно из-за cache effects, большей суммарной memory bandwidth, reduced work или слабого baseline.

</details>

<details>
<summary><b>Q:</b> Могут ли все ядра быть загружены на 100%, а efficiency быть плохой?</summary>

Да — ядра могут busy-wait, пересчитывать данные, конкурировать за ресурсы (contention) или выполнять overhead.

</details>

<details>
<summary><b>Q:</b> Запишите Amdahl's law и его предел.</summary>

$\sigma$ — последовательная доля при фиксированной нагрузке:
$$T_p = T_s\left(\sigma + \frac{1-\sigma}{p}\right) + T_{overhead}(p),\qquad S \le \frac{1}{\sigma + \frac{1-\sigma}{p}} \le \frac{1}{\sigma}$$

</details>

<details>
<summary><b>Q:</b> Amdahl: $\sigma = 0.05$. Каковы max S и E при p = 10, 100, ∞?</summary>

- p=10: $S = 1/(0.05+0.095) \approx 6.9$, E ≈ 69%
- p=100: S ≈ 16.8, E ≈ 17%
- p=∞: S = 1/σ = 20, E → 0

</details>

<details>
<summary><b>Q:</b> Amdahl: 90% программы параллелизуемо, p = 10. Speedup и efficiency?</summary>

$\sigma = 0.1$: $S = 1/(0.1 + 0.9/10) = 1/0.19 \approx 5.26$, $E \approx 52.6\%$. Предел при $p\to\infty$ — 10.

</details>

<details>
<summary><b>Q:</b> Запишите Gustafson-Barsis' law.</summary>

Scaled speedup: $S_G(p) = \sigma + p(1-\sigma) = p - (p-1)\sigma$.

</details>

<details>
<summary><b>Q:</b> Gustafson: $p = 1024$, $\sigma = 0.004$. Scaled speedup? Что дал бы Amdahl?</summary>

$S_G = 1024 - 1023\cdot0.004 \approx 1020$. По Amdahl: $S \le 1/\sigma = 250$ (≈ 201 при p=1024). Так Gustafson & Barsis «побили» Amdahl на nCUBE 10.

</details>

<details>
<summary><b>Q:</b> Чем отличаются вопросы Amdahl и Gustafson? Противоречат ли законы друг другу?</summary>

Amdahl: как быстро решить **ту же** задачу. Gustafson: насколько **большую** задачу можно решить за то же время. Не противоречат: Amdahl верен математически, но $\sigma = \sigma(N)$ обычно убывает с ростом N.

</details>

<details>
<summary><b>Q:</b> Когда алгоритм называют effectively parallel?</summary>

Если последовательная доля $\sigma \to 0$ при $N \to \infty$.

</details>

<details>
<summary><b>Q:</b> Запишите scaled efficiency / weak-scaling efficiency. Что значит идеальный weak scaling?</summary>

$E_S(N,P) = \dfrac{t_{seq}(N)}{t_{par}(P\cdot N,P)}$, или $E_{weak}(p) = \dfrac{T(N_0,1)}{T(N(p),p)}$, где у каждого процессора примерно одинаковая работа. Идеал — **постоянное время** выполнения ($E_S = 1$), а не автоматически linear speedup.

</details>

<details>
<summary><b>Q:</b> Назовите методы повышения efficiency с примерами.</summary>

- **Overlapping communication and computation**: sparse Ax в domain decomposition — начать non-blocking обмен и считать внутренние точки.
- **Extra computations instead of communication**: random numbers — broadcast только seed, генерировать локально детерминированно.
- Улучшение алгоритма; profiling (gprof, Vampir, mpiP, HPCToolkit, Valgrind…).

</details>

<details>
<summary><b>Q:</b> Что такое cost и cost-optimal parallel system?</summary>

Cost = $p \cdot T_P$ (work, processor-time product). Cost-optimal, если $p\,T_P = \Theta(T_S)$; тогда $E = \Theta(1)$.

</details>

<details>
<summary><b>Q:</b> Cost-optimal ли сложение n чисел на n процессорах? Как исправить?</summary>

Нет: cost $= n\log n$, а $T_S = \Theta(n)$. Исправление: каждый процессор суммирует локальный блок, затем tree reduction: $T_p = \Theta(n/p + \log p)$. При $p = \Theta(n/\log n)$: $T_p = \Theta(\log n)$, $pT_p = \Theta(n)$ — cost-optimal.

</details>

<details>
<summary><b>Q:</b> $T_S = 100$ с, на $p = 8$ получено $T_P = 16$ с. Найдите S, E, cost и $T_o$.</summary>

$S = 100/16 = 6.25$; $E = 6.25/8 \approx 0.78$; cost $= 8\cdot16 = 128$; $T_o = 128 - 100 = 28$ с.

</details>

<details>
<summary><b>Q:</b> Определения $O$, $\Omega$, $\Theta$.</summary>

- $T(n) = O(f(n))$: $\exists c, n_0 > 0$: $T(n) \le c f(n)$ для $n \ge n_0$.
- $T(n) = \Omega(f(n))$: $T(n) \ge c f(n)$ для $n \ge n_0$.
- $T(n) = \Theta(f(n))$: одновременно $O$ и $\Omega$.

</details>
