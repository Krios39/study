# Карточки — Лекция 01: Introduction

<details>
<summary><b>Q:</b> Concurrent vs parallel: в чём разница?</summary>

- **Concurrent** — несколько действий "в процессе" одновременно, но не обязательно в один момент: может быть через time slices на одном ядре (кажется одновременным).
- **Parallel** — действительно одновременно, нужна аппаратная поддержка (multi-core); может дать ускорение.

</details>

<details>
<summary><b>Q:</b> Что такое distributed computing и какая техника в нём главная?</summary>

Несколько компьютеров, которые общаются сообщениями; компьютеры и процессы работают параллельно. Главная техника — **message passing**. В курсе — одна общая задача на нескольких машинах.

</details>

<details>
<summary><b>Q:</b> Как соотносятся concurrent, parallel, distributed?</summary>

Concurrent — общий термин; parallel и distributed — его подтипы (терминология не вполне единая).

</details>

<details>
<summary><b>Q:</b> Плюсы и минусы distributed по сравнению с parallel?</summary>

- Менее tightly coupled ⇒ можно собрать **больше ресурсов**.
- Но требует **больше работы программиста**, чтобы эти ресурсы использовать.

</details>

<details>
<summary><b>Q:</b> Формулы Amdahl's law (без N и с N процессами)?</summary>

- `speedup = 1 / (1 − p)` (бесконечно много процессов)
- `speedup = 1 / ((1 − p) + p/N)`

p — доля параллелизуемого кода, N — число процессов. Overheads не учитываются.

</details>

<details>
<summary><b>Q:</b> 50% кода последовательно. Каков максимальный speedup по Amdahl?</summary>

`1/(1−0.5) = 2` — время можно сократить максимум на 50%, сколько бы процессоров ни было.

</details>

<details>
<summary><b>Q:</b> p = 0.9, N = 10. Speedup по Amdahl?</summary>

`1 / (0.1 + 0.9/10) = 1/0.19 ≈ 5.26`. Верхний предел при N→∞ — 10.

</details>

<details>
<summary><b>Q:</b> Почему Amdahl's law на практике не так пессимистичен?</summary>

Последовательная часть (инициализация, I/O) часто мала и константна/линейна по размеру задачи, а параллельная (сам алгоритм) — полиномиальна или хуже ⇒ с ростом задачи доля последовательной части уменьшается.

</details>

<details>
<summary><b>Q:</b> Gustafson's law: формула и смысл. Отличие от Amdahl?</summary>

`speedup = s + p·N` — последовательная часть считается константой ⇒ почти линейный рост.
- Amdahl: фиксированная задача — насколько быстрее.
- Gustafson: фиксированное время — **сколько больше данных** обработаем ⇒ параллелизация делает задачи **scalable**.

</details>

<details>
<summary><b>Q:</b> Speedup in latency vs speedup in throughput? Бывает ли super-linear speedup?</summary>

- Latency: `time_old / time_new`.
- Throughput: относится к числу CPU-инструкций (за время).
- Super-linear speedup (больше числа процессоров) — бывает, но редко.

</details>

<details>
<summary><b>Q:</b> Назовите 4 класса Flynn's taxonomy.</summary>

SISD, SIMD, MISD, MIMD — Single/Multiple Instruction stream × Single/Multiple Data stream.

</details>

<details>
<summary><b>Q:</b> Что такое SIMD и где применяется?</summary>

Все процессорные элементы выполняют **одну и ту же инструкцию** за такт над **разными элементами данных**. Для регулярных задач. GPU, vector machines (Cray X-MP, 1980-е), signal processing (FPGA).

</details>

<details>
<summary><b>Q:</b> Что такое MISD и какой пример можно привести?</summary>

Несколько потоков инструкций над одним потоком данных. Редко на практике. **Pipelining** можно считать MISD: инструкции разбиты на фазы, за такт выполняются разные фазы нескольких команд.

</details>

<details>
<summary><b>Q:</b> Какая модель Flynn типична для современных компьютеров?</summary>

**MIMD** — кластеры, grid, multi-core ПК (каждый процессор — свой поток инструкций и свои данные). GPU — SIMD.

</details>

<details>
<summary><b>Q:</b> Shared memory vs distributed memory (в MIMD)?</summary>

- **Shared**: все процессоры имеют прямой доступ к общей физической памяти (multi-core). Проще, но возможны **race conditions**.
- **Distributed**: процесс видит только свою память, остальное — через коммуникацию (кластеры). Требует более тщательного дизайна алгоритма, но даёт ёмкость, недостижимую иначе.
- Также distributed shared memory и hybrid (кластер из multi-core узлов).

</details>

<details>
<summary><b>Q:</b> UMA vs NUMA?</summary>

- **UMA** — одинаковая стоимость доступа ко всей памяти.
- **NUMA** — стоимость доступа разная (но доступ прямой). Распространилось с AMD Opteron / Intel Nehalem.

</details>

<details>
<summary><b>Q:</b> Что такое SMP?</summary>

Symmetric Multi-Processor: единое адресное пространство, равный доступ, равная скорость — по сути shared memory система (кэши — исключение, но управляются автоматически). Asymmetric multiprocessing почти устарел.

</details>

<details>
<summary><b>Q:</b> Что такое PRAM?</summary>

Parallel Random Access Machine — "идеальный" shared memory компьютер (UMA) в теоретических работах.

</details>

<details>
<summary><b>Q:</b> Что такое hybrid system?</summary>

Система с shared и distributed памятью одновременно, напр. кластер, где в каждом узле multi-core CPU. Очень распространено.

</details>

<details>
<summary><b>Q:</b> Processes vs threads с точки зрения памяти?</summary>

- У процессов ОС **своя память** (изолированы).
- **Threads делят память** процесса ⇒ несколько потоков образуют shared memory систему.

</details>

<details>
<summary><b>Q:</b> Существуют ли "concurrent programming languages"?</summary>

По слайдам — строго говоря нет: есть языки, более или менее подходящие для определённых видов concurrent программирования. Иногда параллельным язык делают библиотеки (OpenMP, MPI).

</details>

<details>
<summary><b>Q:</b> Что значит "massively parallel"?</summary>

Строго не определено (как и supercomputer); меняется со временем. GPU, большие кластеры/grid; иногда только кластеры со специальной interconnect (не ethernet).

</details>
