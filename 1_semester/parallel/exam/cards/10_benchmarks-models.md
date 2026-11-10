# Карточки — Лекция 10: Computer Benchmarks; Parallel programming models and languages

<details>
<summary><b>Q:</b> Что такое HPL (Linpack) и для чего используется?</summary>

High Performance Linpack (Jack Dongarra) — решение плотной (dense) системы линейных уравнений на MPI + BLAS; задача максимального размера (~80% памяти). Используется для рейтинга **TOP500**.

</details>

<details>
<summary><b>Q:</b> Что означают Rpeak, Rmax, N, NB в HPL?</summary>

- Rpeak — теоретическая пиковая производительность
- Rmax — максимальная достигнутая производительность
- N — размер матрицы, дающий лучший результат (обычно < 80% памяти)
- NB — blocksize (обычно 32…256; меньше — в целом лучше)

</details>

<details>
<summary><b>Q:</b> Что измеряет Green500 и в каких единицах?</summary>

Energy efficiency HPC-систем, **GFLOPS/Watt**; дополняет TOP500. Пример 2024: Frontier ~62 GFLOPS/W.

</details>

<details>
<summary><b>Q:</b> Зачем был введён HPCG и чем он отличается от HPL?</summary>

HPCG (Conjugate Gradient) нагружает память и коммуникацию: sparse linear algebra, **memory-bound**, лучше отражает реальные научные приложения. HPL — dense, **compute-bound**. HPCG публикуется вместе с HPL.

</details>

<details>
<summary><b>Q:</b> Что измеряет IO500?</summary>

I/O и storage производительность (с 2017): тесты bandwidth и metadata. Важно для data-intensive и checkpoint-heavy приложений.

</details>

<details>
<summary><b>Q:</b> Graph500 vs MLPerf HPC?</summary>

- Graph500: большие графы (BFS, SSSP), irregular memory access и communication, integer.
- MLPerf HPC: AI/deep learning (training и inference) на HPC, организатор MLCommons.

</details>

<details>
<summary><b>Q:</b> Что такое HPL-MxP (HPL-AI)?</summary>

HPL с **mixed precision** (FP16/FP32) + **iterative refinement** до FP64 accuracy. Отражает AI-accelerated суперкомпьютеры (GPU, TPU, AI accelerators).

</details>

<details>
<summary><b>Q:</b> Почему бенчмарки эволюционировали после HPL?</summary>

Нужно учитывать mixed precision, AI workloads, data movement (memory/I/O-bound) и energy efficiency, которые HPL (dense FP64, compute-bound) не отражает.

</details>

<details>
<summary><b>Q:</b> Сопоставьте бенчмарк и тип нагрузки: HPL, HPCG, Graph500, IO500, Green500, HPL-AI, MLPerf HPC.</summary>

HPL — compute-bound; HPCG — memory-bound; Graph500 — irregular; IO500 — storage; Green500 — energy; HPL-AI — mixed precision; MLPerf HPC — AI.

</details>

<details>
<summary><b>Q:</b> Упрощённая классификация parallel programming patterns по организации вычислений?</summary>

- By data: linear → Geometric Decomposition; recursive → Recursive Data.
- By tasks: linear → Task Parallelism; recursive → Divide and Conquer.
- By data flow: regular → Pipeline; irregular → Event-based Coordination.

</details>

<details>
<summary><b>Q:</b> Приведите примеры языков/систем для моделей: message passing, multi-threaded, PGAS, GPU, actor, CSP.</summary>

Message passing — MPI, PVM; multi-threaded — OpenMP, Clojure; PGAS — HPF, Fortran coarrays; GPU — CUDA, OpenCL, OpenACC, OpenHMPP; actor — Erlang, Elixir, Scala; CSP — Occam, FortranM.

</details>

<details>
<summary><b>Q:</b> Что такое PRAM model?</summary>

Parallel Random Access Machine: $P$ детерминированных RAM-процессоров (von Neumann), работающих параллельно; коммуникация и синхронизация через **shared memory**; $P$ неограничено.

</details>

<details>
<summary><b>Q:</b> Перечислите варианты PRAM.</summary>

EREW (Exclusive Read Exclusive Write), CREW (Concurrent Read Exclusive Write), CRCW (Concurrent Read Concurrent Write).

</details>

<details>
<summary><b>Q:</b> Как разрешаются конфликты записи в CRCW PRAM (три варианта)?</summary>

- Common — запись успешна, только если все пишут одинаковое значение.
- Arbitrary — успешен произвольный процесс.
- Priority — по заранее заданным приоритетам.

</details>

<details>
<summary><b>Q:</b> Сформулируйте Brent's theorem и смысл $T_1$, $T_p$, $T_\infty$.</summary>

$$\frac{T_1}{p} \le T_p \le \frac{T_1}{p} + T_\infty$$
$T_1$ — время на 1 процессоре (= число узлов DAG, работа); $T_p$ — на $p$; $T_\infty$ — глубина DAG (число уровней зависимостей).

</details>

<details>
<summary><b>Q:</b> Докажите Brent's theorem.</summary>

Пусть на уровне $i$ DAG $m_i$ операций, уровней $n = T_\infty$, $T_1 = \sum m_i$. Уровень $i$ на $p$ процессорах занимает $\lceil m_i/p\rceil \le m_i/p + 1$. Суммируя: $T_p \le \sum(m_i/p + 1) = T_1/p + T_\infty$. Нижняя граница $T_1/p$ очевидна: $p$ процессоров не могут сделать больше $p$ операций за шаг.

</details>

<details>
<summary><b>Q:</b> DAG: 14 узлов, глубина 4. Оцените $T_p$ по Brent для p = 2 и p = 7.</summary>

- p=2: $7 \le T_2 \le 7 + 4 = 11$
- p=7: $2 \le T_7 \le 2 + 4 = 6$ (и $T_p \ge T_\infty = 4$ при любом p)

</details>

<details>
<summary><b>Q:</b> Что следует из Brent's theorem о выборе числа процессоров?</summary>

Пока $T_1/p \gg T_\infty$, т.е. $p \ll T_1/T_\infty$ (average parallelism), $T_p \approx T_1/p$ — почти линейный speedup. При больших $p$ доминирует $T_\infty$ и speedup насыщается.

</details>

<details>
<summary><b>Q:</b> Что такое HPF? Основные идеи.</summary>

High Performance Fortran — PGAS расширение Fortran90, SPMD. Директивы `!HPF$` (PROCESSORS, DISTRIBUTE, ALIGN) задают распределение данных; **owner computes rule** — вычисляет владелец результата. Легко писать, трудно получить хорошую efficiency.

</details>

<details>
<summary><b>Q:</b> Как в HPF-примере matmul сделать всю работу локальной?</summary>

`DISTRIBUTE (BLOCK,BLOCK) ONTO square :: C` на 2×2 процессорах; `ALIGN A(i,*) WITH C(i,*)` и `ALIGN B(*,j) WITH C(*,j)` — реплицировать нужные строки A и столбцы B на процессоры, считающие C(i,j). Тогда `C(i,j)=DOT_PRODUCT(A(i,:),B(:,j))` без коммуникации.

</details>

<details>
<summary><b>Q:</b> Какова методика программирования на HPF?</summary>

1. Написать корректную serial-программу, протестировать и отладить.
2. Добавить distribution directives, вводя как можно меньше коммуникации.

</details>

<details>
<summary><b>Q:</b> Что такое Fortran coarrays и их ключевые свойства?</summary>

Fortran 2008/2018, PGAS. Codimension `[ ]` указывает image. Коммуникация **one-sided** (удалённый image не делает ответного вызова). Проще MPI; synchronization intrinsics; корректная программа не должна иметь deadlock/race. Любая переменная может быть coarray; teams of images.

</details>

<details>
<summary><b>Q:</b> Что делают <code>i[5] = i</code> и <code>r(:,:) = r(:,:)[3,3]</code> в coarray Fortran?</summary>

`i[5] = i` — remote write: локальное `i` записывается в `i` на image 5. `r(:,:) = r(:,:)[3,3]` — remote read: копирование массива с image с cosubscripts [3,3] в локальный.

</details>

<details>
<summary><b>Q:</b> Когда стоит использовать MPI?</summary>

Нужны portability и performance; irregular data structures; создание библиотек/инструментов для других; управление памятью per processor.

</details>

<details>
<summary><b>Q:</b> Когда MPI НЕ стоит использовать?</summary>

Regular computation, которая хорошо ложится на HPF/OpenMP; решение (библиотека) уже существует; требуется fault tolerance; distributed computing (CORBA, DCOM).

</details>

<details>
<summary><b>Q:</b> PGAS — что это означает?</summary>

Partitioned Global Address Space: глобальное адресное пространство, логически разделённое на части, каждая из которых «принадлежит» определённому процессу/image (локальный доступ дешевле удалённого). Примеры: HPF, Fortran coarrays.

</details>
