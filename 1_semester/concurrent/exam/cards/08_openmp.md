# Карточки — Лекция 08: OpenMP — Introduction to OpenMP, Loop Parallelism and Scheduling, Synchronization Techniques

<details>
<summary><b>Q:</b> Does the C++ language itself provide parallelism? What options exist?</summary>

Нет, в управляющих конструкциях языка параллелизма нет. Варианты:
- auto-parallelization компилятора (Intel, GCC);
- parallel libraries (libstdc++ parallel mode);
- **pthreads** («родные» потоки);
- чаще всего **OpenMP**.

</details>

<details>
<summary><b>Q:</b> What is OpenMP?</summary>

De-facto стандарт **shared-memory параллелизма** (multithreading) для **C, C++, Fortran**. Работает в основном через `#pragma omp` directives + runtime library + environment variables. Переносим между компиляторами, текущая спецификация 6.0.

</details>

<details>
<summary><b>Q:</b> Name the layers of the OpenMP architecture.</summary>

- **User layer:** End User, Application
- **Programming layer:** Directives/Compiler, OpenMP library, Environment variables
- **System layer:** OpenMP Runtime library, OS support for shared memory & threading
- **HW:** processors над **Shared Address Space**

</details>

<details>
<summary><b>Q:</b> What happens if you compile an OpenMP program without OpenMP support? What flag enables it in gcc?</summary>

Компилятор игнорирует `#pragma omp`, и получается **корректная последовательная программа** («programs should compile without OpenMP»). Флаг для gcc: **`-fopenmp`**.

</details>

<details>
<summary><b>Q:</b> What can this program print with 4 threads?

```c
#pragma omp parallel
{
    int ID = omp_get_thread_num();
    printf(" hello(%d) ", ID);
    printf(" world(%d) \n", ID);
}
```
</summary>

Каждый из 4 потоков печатает свои hello/world, но **порядок недетерминирован** и строки перемешиваются. Например:
`hello(1) hello(0) world(1) world(0) hello(3) hello(2) world(3) world(2)`.

Гарантировано только, что у каждого потока `hello(k)` идёт раньше `world(k)`.

</details>

<details>
<summary><b>Q:</b> How do you set the number of threads? What is the default?</summary>

По умолчанию число потоков равно **числу ядер**. Варианты:
- `omp_set_num_threads(4);` — обычная C-функция, **не** директива;
- [доп.] clause `num_threads(4)`;
- [доп.] переменная окружения `OMP_NUM_THREADS`.

</details>

<details>
<summary><b>Q:</b> Default data-sharing rules in a parallel region?</summary>

- Переменные, объявленные **вне** блока, **shared**.
- Объявленные **внутри** блока, **private**.
- Локальные переменные функций, вызванных из региона, тоже private.
- Переменная цикла в `parallel for` private.

</details>

<details>
<summary><b>Q:</b> private vs firstprivate vs lastprivate?</summary>

- **private:** у каждого потока своя копия, **не инициализированная**.
- **firstprivate:** private-копия **инициализирована исходным значением**.
- **lastprivate:** после конструкции значение копируется обратно в исходную переменную. Слайд говорит «from the last finishing thread»; точнее, из **последней по порядку итерации**.

</details>

<details>
<summary><b>Q:</b> What is printed?

```c
double tmp = 0;
#pragma omp parallel for lastprivate(tmp)
for (int i = 0; i < 4; i++) tmp = i * 10;
printf("%f\n", tmp);
```
</summary>

`30.000000`: lastprivate берёт значение из последней итерации (`i = 3`), независимо от того, какой поток закончил последним. Без `lastprivate` (просто `private`) исходный `tmp` остался бы неизменным (0).

</details>

<details>
<summary><b>Q:</b> What's wrong with making a pointer `private` without allocating in the parallel region?</summary>

Private-копия указателя **не инициализирована** (мусор). Разыменование даёт **segmentation fault**. Нужно выделить память внутри региона или использовать `firstprivate`, если всем подходит один и тот же адрес.

</details>

<details>
<summary><b>Q:</b> What is the implicit barrier, and how do `nowait` and `#pragma omp barrier` relate to it?</summary>

- В конце параллельного блока (и worksharing-конструкций `for`, `sections`, `single`) есть **implicit barrier**, «automatic join»: дальше идут, только когда все потоки закончили.
- **`nowait`** убирает барьер. Это clause, например `#pragma omp for nowait`. Барьер в конце `parallel` убрать нельзя.
- **`#pragma omp barrier`** ставит явный барьер в любом месте внутри региона.

</details>

<details>
<summary><b>Q:</b> Why can't this loop be parallelized as is, and how to fix it?

```c
j = 5;
for (i = 0; i < MAX; i++) { j += 2; A[i] = big(j); }
```
</summary>

**Loop-carried dependency**: `j` в итерации `i` зависит от предыдущей итерации, а итерации должны быть независимы.

Исправление: вычислять `j` из `i`:
```c
#pragma omp parallel for
for (i = 0; i < MAX; i++) { int j = 7 + 2*i; A[i] = big(j); }
```

</details>

<details>
<summary><b>Q:</b> What's the problem here and how does OpenMP solve it?

```c
#pragma omp parallel for
for (i = 0; i < MAX; i++) ave += A[i];
```
</summary>

**Race condition** на shared `ave`: несколько потоков одновременно делают read-modify-write, обновления теряются.

Решение — `reduction`:
```c
#pragma omp parallel for reduction(+:ave)
```
Каждый поток копит частичную сумму в private-копии (инициализирована 0), в конце копии складываются в `ave`.

</details>

<details>
<summary><b>Q:</b> Which operators can be used in `reduction` (as listed on the slide)?</summary>

`+, -, *, &&, ||, &, |, ^` ([доп.] и `min`, `max`).

</details>

<details>
<summary><b>Q:</b> What does `collapse(3)` do, and why is `schedule(dynamic)` used in the slide example?</summary>

- `collapse(3)` сливает 3 вложенных цикла в **одно пространство итераций** ($N^3$). Работы для распределения больше, баланс лучше.
- `schedule(dynamic)` выбран, потому что `f(i,j,k)` дорогая и её **время выполнения переменное**. Динамическая раздача выравнивает нагрузку.

</details>

<details>
<summary><b>Q:</b> Compare `schedule(static)`, `schedule(dynamic)`, `schedule(guided)`.</summary>

[доп., на слайде только dynamic]
- **static:** итерации заранее делятся на блоки (или chunk round-robin). Минимальный overhead, подходит для равных итераций.
- **dynamic:** свободный поток берёт следующий chunk (по умолчанию 1). Хорош для неравномерных итераций, overhead выше.
- **guided:** динамически, но chunk уменьшается по мере выполнения. Компромисс.
- Также `auto` (решает runtime) и `runtime` (из `OMP_SCHEDULE`).

</details>

<details>
<summary><b>Q:</b> What are `sections` used for?</summary>

Для параллельного выполнения **разного кода** (функциональный параллелизм). Каждый блок `#pragma omp section` внутри `#pragma omp sections` выполняется одним потоком.

</details>

<details>
<summary><b>Q:</b> What does `#pragma omp critical` do? What's special about an unnamed critical?</summary>

Блок выполняется **только одним потоком в каждый момент** (mutual exclusion).

Безымянный critical **глобальный**: все безымянные critical-секции программы используют один общий lock и блокируют друг друга. Именованные (`#pragma omp critical (foo)`) с разными именами независимы.

</details>

<details>
<summary><b>Q:</b> atomic vs critical?</summary>

- **atomic:** быстрее (часто аппаратная инструкция), но только для **одного простого оператора обновления** одной переменной (`x++`, `--x`, `x += expr`…). Правая часть `expr` не защищена.
- **critical:** произвольный блок кода, но дороже.

</details>

<details>
<summary><b>Q:</b> In this code, which part runs in parallel and which part is protected?

```c
#pragma omp parallel
{
    double tmp, B;
    B = DOIT();
    tmp = big_ugly(B);
    #pragma omp atomic
    X += tmp;
}
```
</summary>

`DOIT()` и `big_ugly(B)` выполняются **параллельно** (B и tmp private, объявлены внутри). Атомарно защищено только обновление `X += tmp` общей переменной `X`.

</details>

<details>
<summary><b>Q:</b> What's the bug in this slide loop?

```c
for (i = id; i < niters; i + nthrds) { ... }
```
</summary>

`i + nthrds` вычисляет значение, но **не изменяет `i`**, поэтому цикл бесконечный. Должно быть `i += nthrds`. Тогда это cyclic-распределение итераций: поток `id` берёт `id, id+nthrds, id+2·nthrds, …`.

</details>

<details>
<summary><b>Q:</b> single vs master?</summary>

- **single:** блок выполняет **один любой** поток. В конце **implicit barrier** (остальные ждут).
- **master:** только **master-поток** (ID 0), **без барьера**. [доп.] В OpenMP 5.1+ `master` заменён на `masked`.

</details>

<details>
<summary><b>Q:</b> Write the OpenMP lock API lifecycle.</summary>

```c
omp_lock_t lck;
omp_init_lock(&lck);
// в параллельном регионе:
omp_set_lock(&lck);    // захват (ждёт, если занят)
/* критический код */
omp_unset_lock(&lck);  // освобождение
omp_destroy_lock(&lck);
```
Locks — низкоуровневая альтернатива `critical`.

</details>

<details>
<summary><b>Q:</b> What are OpenMP tasks, and what does `taskwait` do?</summary>

**Task** — единица работы, создаваемая динамически, её выполнит какой-либо поток команды (похоже на thread pool). Подходит для рекурсии и нерегулярной работы.

`#pragma omp taskwait` ждёт завершения **всех дочерних задач текущей задачи**.

</details>

<details>
<summary><b>Q:</b> In the task-based `fib`, why are `i`, `j` shared and `n` firstprivate?

```c
#pragma omp task shared(i) firstprivate(n)
i = fib(n-1);
#pragma omp task shared(j) firstprivate(n)
j = fib(n-2);
#pragma omp taskwait
return i + j;
```
</summary>

- `i`, `j` **shared**: задачи пишут результат в переменные родителя. Если бы они были private, запись потерялась бы.
- `n` **firstprivate**: значение `n` захватывается при создании задачи.
- `taskwait` нужен, чтобы перед `i + j` обе задачи уже завершились.

</details>

<details>
<summary><b>Q:</b> What does `if(n > 20)` do in `#pragma omp task shared(i) if(n > 20)`?</summary>

Задача создаётся как отдельная (отложенная) **только при n > 20**. Иначе код выполняется **сразу**, без overhead на создание задачи. Так параллелизм не дробится на слишком мелкие задачи.

</details>

<details>
<summary><b>Q:</b> How do you prevent OpenMP from dynamically adjusting the number of threads?</summary>

```c
omp_set_dynamic(0);
omp_set_num_threads(omp_get_num_procs());
```
Реальное число потоков узнают **внутри** региона (`omp_get_num_threads()` в `#pragma omp single`), потому что вне региона функция возвращает 1.

</details>

<details>
<summary><b>Q:</b> What does `omp_get_num_threads()` return outside vs inside a parallel region?</summary>

- Вне: **1** (работает только master).
- Внутри: размер текущей команды потоков.

`omp_get_thread_num()` даёт ID текущего потока, $0 \ldots n-1$.

</details>

<details>
<summary><b>Q:</b> Which `for` loops can `#pragma omp parallel for` handle?</summary>

Только **«настоящие» (canonical) for-циклы**: известное до входа число итераций, целочисленная переменная цикла, простое условие и инкремент, без `break`. Итерации должны быть **независимы**. `while` и циклы с изменяемой границей не подходят.

</details>

<details>
<summary><b>Q:</b> OpenMP vs Java threads: how does creating parallel work differ?</summary>

- **Java:** явно создаёшь `Thread`/Runnable с отдельной функцией `run`, вызываешь start/join.
- **OpenMP:** помечаешь **блок** директивой, и **каждый поток выполняет копию этого блока** (fork-join), join неявный (barrier).

Race conditions и синхронизацию в обоих случаях нужно обрабатывать вручную.

</details>
