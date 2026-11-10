# Лекция 03: What is parallel computing

Слайды: lecture-slides.pdf, стр. 32–56

## Serial vs parallel computing
- **Serial computing**: задача разбивается на последовательность инструкций, они выполняются по одной на одном процессоре — единый sequential instruction stream / sequential semantics. Цепочка зависимостей A → B → C → D …
- Ключевой вопрос: **фиксирован ли порядок выполнения инструкций, или его можно изменить с тем же результатом?**
- **Parallel computing** — одновременное использование нескольких вычислительных ресурсов для решения задачи:
  - задача разбивается на дискретные части, решаемые concurrently;
  - каждая часть — последовательность инструкций;
  - инструкции разных частей выполняются одновременно на разных процессорах;
  - нужен общий механизм control/coordination.
  - Ресурсы: компьютер с несколькими cores/CPU и/или несколько компьютеров, соединённых сетью.

## Условия для распараллеливания
- Задачу можно разбить на дискретные куски работы, решаемые одновременно; в каждый момент можно выполнять несколько инструкций.
- Цель: решить задачу **быстрее**, чем на одном ресурсе.
- Легко ли? Иногда да; обычно — совсем нет. Автоматизация распараллеливания бывает простой в одних случаях и крайне сложной в других; универсальной стратегии автоматического распараллеливания создать крайне трудно.
- Ключевой фактор — **granularity** параллельных секций.

## Granularity
**Определение**: размер распараллеливаемых (независимых) частей программы между точками синхронизации.

| | Fine-grain | Coarse-grain | Embarrassingly parallel |
|---|---|---|---|
| Работа между comm/sync | мало | много | почти нет comm |
| Computation/communication ratio | низкое | высокое | — (самая грубая) |
| Load balancing | легче | труднее | — |
| Автоматизация | легче | труднее | — |
| Пример | ILP | loop iteration, task | Monte Carlo, обработка огромного набора изображений (по процессу/узлу) |

- Coarse-grain даёт больше возможностей выиграть на компромиссе «доступный параллелизм vs overhead».
- Шкала от мелкой к крупной: instruction → SIMD → loop iteration → task.

## Levels of parallelism
- **Bit-level** (16-bit add на 8-bit CPU) → **ILP** → **SIMD/DLP** → **loop-level** (`for i: x(i)=x(i)+y(i)`) → **thread/task-level** (multi-core CPUs) → **distributed**.

## Instruction Level Parallelism (ILP)
- ILP — параллелизм с **наименьшей granularity**; мера того, сколько инструкций программы можно выполнить одновременно.
- Parallel instructions — набор инструкций, не зависящих друг от друга при выполнении.
- Пример: `e=a+b; f=c+d; g=e*f` — e и f параллельно, затем g ⇒ **2 единицы времени** (вместо 3).
- ILP — задача для:
  - **CPU**: pipelining, register renaming, out-of-order execution, speculative execution, branch prediction;
  - **Compiler**: reordering, loop unrolling, vectorisation.

### Instruction pipelining
- Аналогия — конвейер сборки автомобилей.
- Классический 5-stage RISC pipeline: **IF** (Instruction Fetch), **ID** (Instruction Decode), **EX** (Execute), **MEM** (Memory access), **WB** (Register write back).
- В 4-м такте самая ранняя инструкция в MEM, а самая поздняя ещё не вошла в pipeline.

### Pipeline hazards — почему инструкция должна ждать
| Hazard | Проблема | Вопрос | Решение |
|---|---|---|---|
| **Structural** | две инструкции нужен один аппаратный ресурс | «Who gets the machine?» | больше ресурсов |
| **Data** | нужен результат, который ещё не готов | «Where is my data?» | forwarding / stall / OoO |
| **Control** | CPU не знает, какая инструкция следующая | «Where do I go next?» | branch prediction |

- **Structural**: инструкция A делает MEM, а одновременно нужно IF следующей; если общий единственный порт памяти — конфликт. Решение: раздельные instruction/data caches, несколько execution units, несколько memory ports.
- **Data hazard (RAW)**: `I1: R1=R2+R3; I2: R4=R1*R5` — I2 нужен R1 ⇒ процессор вставляет **bubble (stall)**.
- **Forwarding / bypassing**: результат передаётся напрямую из EX одной инструкции в EX следующей, минуя регистровый файл ⇒ убирает stall.
- **Load-use hazard**: `I1: R1=memory[addr]; I2: R2=R1+R3` — значение появляется только после MEM, поэтому **даже с forwarding нужен 1 stall**. Важен тип инструкции, а не только зависимость.
- Виды зависимостей:
  - **RAW** (Read After Write) — **true dependency**;
  - **WAR** (Write After Read) — false/name dependency;
  - **WAW** (Write After Write) — false/name dependency.
  - В простом in-order 5-stage pipeline важен RAW; WAR и WAW важны при out-of-order execution.
- **Control hazard**: после `if (x>0)` неизвестно, что fetch-ить. Варианты: (1) ждать — корректно, но медленно; (2) угадать путь (branch prediction) — если верно, отлично; (3) если неверно — **flush** неверных инструкций и начать заново по правильному пути. Branch prediction — решение control hazard.
- Общий принцип: **архитектура процессора во многом о том, как избежать ожидания**; цель — держать execution units занятыми.

### Superscalar
- ILP внутри одного CPU; **более одной инструкции за такт**; dispatch нескольких инструкций на несколько избыточных функциональных блоков (ALU, FPU, bit shifter, multiplier) — это execution resources внутри CPU, не отдельные ядра.

### Branch prediction
- Избегает stall в ожидании разрешения control dependencies; используется со speculative execution.
- Виды: static, dynamic, random, one-level, two-level; **Pattern History Table**.
- Ветвление в конце цикла на $10^6$ итераций: taken ~999 999 раз, not taken 1 раз — хорошо предсказуемо.

### Out-of-Order (OoO) execution
- Используется в большинстве high-performance CPU; позволяет избежать задержек из-за недоступности операндов.
- Шаги: instruction fetch → dispatch в instruction queue (buffer) → ожидание в очереди готовности операндов → issue на функциональный блок → результаты в очередь (**re-order buffer**) → write back в регистры.
- Пример: `a=b+c; d=e+f; g=a*d; h=x+y` — critical path длины 2 (a, d → g); одновременно могут выполниться 3 операции (a, d, h).

### Register renaming
- Устраняет ненужную сериализацию из-за повторного использования регистров (false dependencies WAR/WAW); абстрагирует logical registers от physical; позволяет OoO.
- Пример: второй блок `r1=m[2048]; r1=r1+4; m[2056]=r1` переименован на `r2` ⇒ два блока независимы и могут выполняться параллельно.

### Speculative execution
- Выполнение инструкций (или их частей) до того, как известно, нужно ли их выполнять.
- Виды: control flow speculation, value prediction, memory dependence prediction, cache latency prediction.
- **Eager execution** — выполнять все возможные сценарии; **predictive execution** — предсказать наиболее вероятный.

## Memory performance
- Часто узкое место — **memory system, а не скорость процессора**.
- **Latency** — время от запроса до доставки данных из памяти.
- **Bandwidth** — объём данных за единицу времени между процессором и памятью.
- **Пример (memory latency)**: 1 GHz CPU, 2 multiply-add units ⇒ 4 flop/такт ⇒ peak **4 GFLOPS**; память 100 ns без кэша, блок = 1 слово. Dot product: каждое обращение к памяти — 100 тактов ⇒ ~1 flop на 100 ns ⇒ реально **только 10 MFLOPS**.

### Отношение q = f/m (мотивация BLAS)
- $f$ — число flops, $m$ — число обращений к памяти, $q = f/m$.
- Время: $f t_f + m t_m = f t_f\left(1 + \frac{1}{q}\frac{t_m}{t_f}\right)$.
- Так как $t_m \gg t_f$, время отражает скорость процессора, только если **q велико**.
- Иерархия памяти: registers → cache → RAM → storage → network storage/clouds (данные двигаются вверх до операций и вниз после).

### Порядки операций (Gauss elimination и matmul)
| Операция | Тип | $m$ | $f$ | $q$ |
|---|---|---|---|---|
| (1) $y = ax + y$ (**saxpy**) | 1st order, BLAS1, $O(n)$ | $3n+1$ (2n+1 reads, n writes) | $2n$ | $\to 2/3$ |
| (2) $A = A - vw^T$ (**rank-one update**) | 2nd order, BLAS2, $O(n^2)$ | $2n^2+2n$ ($n^2+2n$ reads, $n^2$ writes) | $2n^2$ | $\to 1$ |
| $C = AB + C$ (**matrix multiplication**) | 3rd order, BLAS3, $O(n^3)$ | $4n^2$ | $2n^3$ | $n/2$ |

- Для 1-го и 2-го порядка $q = O(1)$ ⇒ memory-bound. Для 3-го порядка $q \to \infty$ при $n\to\infty$ ⇒ возможна работа почти на peak performance при хорошем scheduling.
- Gauss elimination: для каждого k — op (1) деление столбца (saxpy-тип) и op (2) rank-one update.

### BLAS implementations
- **BLAS** — стандартная библиотека операций 1-го, 2-го, 3-го порядка (netlib); вендоры дают свои реализации; **ATLAS** — self-optimising code; **OpenBLAS** — x86, x86-64, MIPS, ARM. Пример: LU factorisation через BLAS3.

### Cache — сокрытие memory latency
- Cache — маленькая, но быстрая память между CPU и main memory (DRAM); low latency, high throughput.
- **Пример**: cache 32 KB, latency 1 ns; память 100 ns; $C = AB$, A и B — 32×32 (всё влезает в кэш).
  - Чтение 2 матриц (2K слов) ≈ 200 µs.
  - Умножение: $2n^3 = 64$K операций ⇒ 16K тактов (4 op/такт) = 16 µs.
  - Итого 216 µs ⇒ $64\text{K}/216\,\mu s \approx$ **303 MFLOPS** (против 10 MFLOPS без кэша).
- Повторный доступ к тем же данным — **temporal locality**. $O(n^2)$ доступов к данным и $O(n^3)$ вычислений — отличная асимптотика для кэша.
- **Data reuse критически важен**. Cache снижает реальную latency, только если есть достаточно переиспользования.
- **Cache hit ratio** — доля данных, обслуженных из кэша без обращения к main memory; часто главный фактор производительности.

## Processing-in-Memory (in-class exercise 3)
- Тема: memory–CPU bottleneck; одно из решений — **PIM** (подробнее в лекции 4).
