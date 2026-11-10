# Карточки — Лекция 03: What is parallel computing

<details>
<summary><b>Q:</b> Дайте определение parallel computing и его составляющих.</summary>

Одновременное использование нескольких вычислительных ресурсов для решения задачи:
- задача разбивается на дискретные части, решаемые concurrently;
- каждая часть — серия инструкций;
- инструкции разных частей выполняются одновременно на разных процессорах;
- используется общий механизм control/coordination.

</details>

<details>
<summary><b>Q:</b> Что такое granularity?</summary>

Размер распараллеливаемых (независимых) частей программы **между точками синхронизации**.

</details>

<details>
<summary><b>Q:</b> Сравните fine-grain и coarse-grain parallelism.</summary>

- **Fine-grain**: мало работы между comm/sync, низкое computation/communication ratio, легче load-balance, легче автоматизировать (пример: ILP).
- **Coarse-grain**: много работы между comm/sync, высокое computation/communication ratio, больше выигрыша в trade-off параллелизм/overhead, труднее load-balance и автоматизировать.

</details>

<details>
<summary><b>Q:</b> Что такое embarrassingly parallel? Примеры.</summary>

Самая грубая granularity: части практически независимы, коммуникация почти отсутствует. Примеры: Monte Carlo method, обработка огромного набора изображений (по процессу/узлу).

</details>

<details>
<summary><b>Q:</b> Перечислите уровни параллелизма от мелкого к крупному.</summary>

Bit-level → instruction-level (ILP) → SIMD/data-level → loop-level → thread/task-level (multi-core) → distributed.

</details>

<details>
<summary><b>Q:</b> Что такое ILP? Сколько тактов нужно для <code>e=a+b; f=c+d; g=e*f</code>?</summary>

ILP — мера того, сколько инструкций программы можно выполнить одновременно (параллелизм наименьшей granularity). e и f независимы и идут параллельно, g ждёт их ⇒ **2 единицы времени**.

</details>

<details>
<summary><b>Q:</b> Какими средствами CPU и compiler извлекают ILP?</summary>

- CPU: pipelining, register renaming, out-of-order execution, speculative execution, branch prediction (+ superscalar).
- Compiler: instruction reordering, loop unrolling, vectorisation.

</details>

<details>
<summary><b>Q:</b> Назовите стадии классического 5-stage RISC pipeline.</summary>

IF (Instruction Fetch), ID (Instruction Decode), EX (Execute), MEM (Memory access), WB (register Write Back).

</details>

<details>
<summary><b>Q:</b> Три вида pipeline hazards и типичные решения?</summary>

- **Structural** — один аппаратный ресурс нужен двум инструкциям → больше ресурсов (раздельные I/D caches, порты, units).
- **Data** — нужный результат ещё не готов → forwarding, stall, OoO.
- **Control** — неизвестна следующая инструкция → branch prediction (+ speculation, flush при ошибке).

</details>

<details>
<summary><b>Q:</b> Что такое forwarding (bypassing)?</summary>

Передача результата прямо из execution stage одной инструкции на вход EX следующей, минуя память/регистровый файл; убирает stall при RAW-зависимости.

</details>

<details>
<summary><b>Q:</b> Что такое load-use hazard и почему forwarding его не устраняет полностью?</summary>

`R1=memory[addr]; R2=R1+R3` — загруженное значение доступно только после стадии MEM, а не после EX, поэтому даже с forwarding нужен **1 stall**. Важен тип инструкции, а не только факт зависимости.

</details>

<details>
<summary><b>Q:</b> RAW, WAR, WAW — что это и какие из них «true» dependency?</summary>

- RAW (Read After Write) — **true dependency**.
- WAR (Write After Read) и WAW (Write After Write) — **false/name dependencies**, важны при out-of-order execution; устраняются register renaming.

</details>

<details>
<summary><b>Q:</b> Что происходит при неверном branch prediction?</summary>

Неверно загруженные инструкции (IF/ID/EX) **сбрасываются (flush)**, и выполнение начинается заново по правильному пути — теряются такты.

</details>

<details>
<summary><b>Q:</b> Что такое superscalar architecture?</summary>

ILP внутри одного CPU: выполнение **более одной инструкции за такт** через dispatch на несколько избыточных функциональных блоков (ALU, FPU, shifter, multiplier). Это не отдельные ядра, а ресурсы внутри CPU.

</details>

<details>
<summary><b>Q:</b> Опишите шаги out-of-order execution.</summary>

Fetch → dispatch в instruction queue → ожидание готовности операндов → issue на функциональный блок и выполнение → результаты в re-order buffer → write back в регистры (в исходном порядке).

</details>

<details>
<summary><b>Q:</b> Для <code>a=b+c; d=e+f; g=a*d; h=x+y</code>: какова длина critical path и сколько операций могут идти одновременно?</summary>

Critical path: a (или d) → g — длина **2**. Одновременно могут выполниться **3** операции: a, d, h.

</details>

<details>
<summary><b>Q:</b> Зачем нужен register renaming?</summary>

Устраняет ненужную сериализацию из-за повторного использования одних и тех же регистров (WAR/WAW), отделяя logical registers от physical; это позволяет out-of-order execution.

</details>

<details>
<summary><b>Q:</b> Eager execution vs predictive execution?</summary>

Обе — виды speculative execution. **Eager** — выполнять все возможные ветви; **predictive** — выполнять только наиболее вероятную.

</details>

<details>
<summary><b>Q:</b> Latency vs bandwidth памяти?</summary>

- **Latency** — время от запроса до доставки данных.
- **Bandwidth** — объём данных за единицу времени между процессором и памятью.

</details>

<details>
<summary><b>Q:</b> CPU 1 GHz, 4 flop/такт (peak 4 GFLOPS), память 100 ns без кэша. Какова реальная производительность dot product?</summary>

Каждое обращение к памяти — 100 тактов; ≈ 1 flop на 100 ns ⇒ **10 MFLOPS** (в 400 раз ниже пика).

</details>

<details>
<summary><b>Q:</b> Что такое $q = f/m$ и почему это важно?</summary>

$f$ — flops, $m$ — memory references. Время $= f t_f (1 + \frac{1}{q}\frac{t_m}{t_f})$. Поскольку $t_m \gg t_f$, время определяется скоростью процессора, только если $q$ большое.

</details>

<details>
<summary><b>Q:</b> Чему равны $q$ для saxpy, rank-one update и matrix multiplication?</summary>

- saxpy $y=ax+y$: $m=3n+1$, $f=2n$, $q\to 2/3$ (1st order).
- rank-one update $A=A-vw^T$: $m=2n^2+2n$, $f=2n^2$, $q\to 1$ (2nd order).
- $C=AB+C$: $m=4n^2$, $f=2n^3$, $q=n/2$ (3rd order) ⇒ можно приблизиться к peak.

</details>

<details>
<summary><b>Q:</b> Что такое BLAS и уровни BLAS? Назовите реализации.</summary>

Basic Linear Algebra Subroutines — стандарт для операций 1-го (вектор-вектор), 2-го (матрица-вектор) и 3-го (матрица-матрица) порядка. Реализации: reference (netlib), вендорские, **ATLAS** (self-optimising), **OpenBLAS**.

</details>

<details>
<summary><b>Q:</b> Пример с кэшем: cache 1 ns, память 100 ns, $C=AB$ для 32×32, 4 op/такт на 1 GHz. Посчитайте производительность.</summary>

Загрузка 2K слов: ≈ 200 µs. Вычисления: $2\cdot32^3 = 64$K op = 16K тактов = 16 µs. Итого 216 µs ⇒ $64\text{K}/216\,\mu s \approx$ **303 MFLOPS**.

</details>

<details>
<summary><b>Q:</b> Когда cache помогает скрыть memory latency? Что такое hit ratio?</summary>

Только при достаточном **data reuse** (temporal locality). Cache hit ratio — доля обращений, обслуженных кэшем без main memory; часто главный фактор производительности.

</details>

<details>
<summary><b>Q:</b> Почему распараллеливание трудно автоматизировать?</summary>

В одних случаях автоматизация простая, в других крайне сложная; универсальную стратегию создать очень трудно. Ключевой фактор — granularity параллельных секций (и зависимости между ними).

</details>
