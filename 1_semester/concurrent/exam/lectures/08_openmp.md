# Лекция 08: OpenMP — Introduction to OpenMP, Loop Parallelism and Scheduling, Synchronization Techniques

Слайды: session9.pdf

(На слайдах заголовок «Week 9: Shared memory parallelism in C++, OpenMP», Stefan Kuhn.)

Пометка **[доп.]** означает короткое уточнение из общих знаний об OpenMP, которого нет на слайдах или которое там неточно.

---

## 1. Контекст: параллелизм в C++

- Раньше различали **shared memory** и **distributed memory** параллелизм. В Java была многопоточность (shared memory).
- **Сам язык C++ не содержит параллелизма** в управляющих конструкциях.
- Варианты:
  - **auto-parallelization** компилятора (Intel C++ Compiler, GCC) превращает последовательный код в многопоточный;
  - параллельные библиотеки (libstdc++ parallel mode);
  - «родные» потоки — **pthreads** (POSIX threads);
  - на практике чаще всего используют **OpenMP**.

## 2. Что такое OpenMP

- API для **параллельного выполнения**, **de-facto standard** для shared-memory параллелизма (multithreading) в **C, C++ и Fortran**.
- Текущая спецификация **6.0**, сайт openmp.org. **Portable** между компиляторами.
- **Архитектура (слои):**
  - **User layer:** End User → Application;
  - **Programming layer:** Directives/Compiler, OpenMP library, Environment variables;
  - **System layer:** OpenMP Runtime library, OS/system support for shared memory and threading;
  - **HW:** Proc1…ProcN над **Shared Address Space**.
- Программирование идёт в основном через **preprocessor directives** `#pragma omp ...` («pragma» в C — общий термин для расширений).
- **Programs should compile without OpenMP**: если игнорировать `#pragma omp`, получится корректная **последовательная** программа.
- Нужен **флаг компилятора**: `-fopenmp` (gcc). Заголовок `#include <omp.h>`.

## 3. `parallel`: параллельный регион

```c
#include "omp.h"
void main() {
  #pragma omp parallel          // parallel block с числом потоков по умолчанию
  {
      int ID = omp_get_thread_num();
      printf(" hello(%d) ", ID);
      printf(" world(%d) \n", ID);
  }
}
```
- Возможный вывод: `hello(1) hello(0) world(1) world(0) hello(3) hello(2) world(3) world(2)`. **Порядок недетерминирован**, строки перемешиваются.
- **Каждый поток выполняет копию кода блока** (модель fork-join; в Java поток явно создают с отдельной функцией run).
- Число потоков по умолчанию равно числу ядер. Задать вручную: `omp_set_num_threads(4);`. Это **C-функция**, а не директива. **[доп.]** Также `num_threads(n)` clause и переменная окружения `OMP_NUM_THREADS`.
- Полезные функции: `omp_get_thread_num()` (ID потока, у master 0), `omp_get_num_threads()` (число потоков в команде), `omp_get_num_procs()`.

## 4. Data sharing: shared / private / firstprivate / lastprivate

- Переменные, **объявленные вне блока**, по умолчанию **shared** (общие).
- Переменные, **объявленные внутри блока**, **private** (у каждого потока своя копия).
- Переменные функций, вызванных из параллельного блока, тоже private (они на стеке потока).
- Явно: `#pragma omp parallel shared(n, a) private(b)`.
- **`private`**: копия **не инициализирована**, её нужно инициализировать внутри блока.
- **`firstprivate`**: каждая private-копия **инициализируется исходным значением** переменной.
- **`lastprivate`**: после цикла значение копируется обратно в исходную переменную. На слайде сказано «from the last finishing thread»; **[доп.]** точнее, берётся значение из **последней по порядку итерации** (sequentially last iteration), а не от потока, который закончил последним.
- **Private pointer** без выделения памяти внутри региона приводит к **segmentation fault** (копия указателя не инициализирована).
- Примеры:
  ```c
  float s[8]; s[0] = calculateBase(...);
  #pragma omp parallel for firstprivate(s)   // у каждого потока копия s с s[0] = база
  for (int i = 0; i < n; i++) { s[..] = ..; .. = ..s[..]; }

  #pragma omp parallel for lastprivate(tmp)
  for (int i = 0; i < n; i++) {
      tmp = x[i]*x[i]*3.1415;
      z[i] = tmp*x[i] + y[i];
      t[i] = tmp*y[i];
  }
  printf("tmp = %f\n", tmp);                  // значение из итерации i = n-1
  ```

## 5. Barrier и nowait

- **Race conditions** возможны, как в Java, и обрабатываются вручную.
- В конце параллельного блока есть **implicit barrier** («automatic join»): программа продолжается, только когда все потоки закончили.
- Барьер можно убрать с помощью `nowait`. **[доп.]** `nowait` — это **clause** worksharing-конструкций (`#pragma omp for nowait`, `sections nowait`, `single nowait`). Неявный барьер в конце самого `parallel` убрать нельзя.
- Явный барьер внутри региона: `#pragma omp barrier`. Все потоки ждут друг друга в этой точке.

## 6. `parallel for`: параллелизм циклов

```c
#pragma omp parallel for
for (i = 1; i < 13; i++) {
    c[i] = a[i] + b[i];
}
```
- Итерации распределяются между потоками. Loop scheduling можно настроить.
- Работает только для **«настоящих» for-циклов** (canonical form: известное число итераций, простой инкремент, без `break`).
- **Итерации должны быть независимы.** Этот цикл **нельзя** распараллелить как есть:
  ```c
  j = 5;
  for (i = 0; i < MAX; i++) { j += 2; A[i] = big(j); }  // loop-carried dependency через j
  ```
  **[доп.]** Исправление: убрать зависимость, `j = 5 + 2*(i+1)`, тогда `A[i] = big(j)` с `j` private.
- Переменная цикла `i` в `parallel for` автоматически private.

### Reduction
Наивная сумма даёт **race condition** на `ave`:
```c
double ave = 0.0, A[MAX];
#pragma omp parallel for reduction(+:ave)
for (i = 0; i < MAX; i++) ave += A[i];
ave = ave / MAX;
```
- Каждый поток получает private-копию `ave`, инициализированную нейтральным элементом операции (0 для `+`, 1 для `*`). В конце копии объединяются оператором в исходную переменную.
- Операторы на слайде: `+, -, *, &&, ||, &, |, ^`. **[доп.]** Также `min`, `max`.

### collapse
```c
#pragma omp parallel for collapse(3) schedule(dynamic)
for (i = 0; i < N; i++)
  for (j = 0; j < N; j++)
    for (k = 0; k < N; k++)
      A[i][j][k] = f(i, j, k);   // f дорогая, время выполнения переменное
```
- `collapse(3)` сливает три вложенных цикла в **одно пространство итераций** ($N^3 = 1000$). Работы для распределения становится больше, балансировка лучше.
- `schedule(dynamic)` здесь нужен, потому что время итераций **неравномерно**.

### Scheduling **[доп.: на слайдах только `schedule(dynamic)` и «loop scheduling can be influenced»]**
`schedule(kind[, chunk])`:
| kind | Как распределяет | Когда использовать |
|---|---|---|
| `static` | итерации заранее делятся на блоки (по умолчанию примерно равные куски; с `chunk` — round-robin по chunk) | равная стоимость итераций, минимальный overhead |
| `dynamic` | поток берёт следующий chunk (по умолчанию 1), когда освободился | неравномерная стоимость итераций; overhead выше |
| `guided` | как dynamic, но chunk уменьшается (пропорционален оставшимся итерациям) | компромисс между балансом и overhead |
| `auto` | решает компилятор/runtime | |
| `runtime` | берётся из `OMP_SCHEDULE` | эксперименты без перекомпиляции |

## 7. `sections`: разный код параллельно

```c
#pragma omp parallel sections
{
    #pragma omp section
    { taskA(); }
    #pragma omp section
    { taskB(); }
}
```
Каждую `section` выполняет один поток. Это **функциональный** (task) параллелизм, а не по данным. Синтаксис: `#pragma omp sections [clause[[,] clause]...]`.

## 8. Synchronization

### critical
```c
float res;
#pragma omp parallel
{
    float B; int i, id, nthrds;
    id = omp_get_thread_num();
    nthrds = omp_get_num_threads();
    for (i = id; i < niters; i += nthrds) {   // на слайде опечатка: i+nthrds
        B = big_job(i);
        #pragma omp critical
        consume(B, res);
    }
}
```
- `critical` — блок, который в каждый момент выполняет **только один поток** (mutual exclusion).
- Безымянный critical **глобальный**: все безымянные critical во всей программе используют **один общий lock**. Чтобы сделать его «локальным», ему дают **имя**: `#pragma omp critical (foo)`. Критические секции с разными именами не блокируют друг друга.
- Цикл `for (i = id; i < niters; i += nthrds)` — ручное **cyclic** распределение итераций по ID потока (SPMD-стиль).

### atomic
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
- **Быстрее critical** (часто аппаратная атомарная инструкция), но только для **одного простого оператора** обновления одной переменной в памяти.
- Слайд: «Only allows `x++; ++x; x--; --x;`, other variants exist». **[доп.]** Также `x binop= expr` (`+=, -=, *=, /=, &=, |=, ^=, <<=, >>=`), и есть формы `atomic read/write/capture`. Вычисление `expr` (здесь `big_ugly`) **не** защищено и выполняется параллельно.

### single / master
```c
#pragma omp parallel
{
    do_many_things();
    #pragma omp single
    { exchange_boundaries(); }   // выполнит ровно один (любой) поток
    do_many_other_things();
}
```
- `single`: блок выполняет **один любой поток**. В конце **implicit barrier** (остальные ждут), если нет `nowait`.
- `master`: блок выполняет **только master-поток** (ID 0), **без барьера**. **[доп.]** В OpenMP 5.1+ `master` deprecated, вместо него `masked`.
- **Single has an implied barrier, master doesn't.**

### Locks (низкоуровневые)
```c
omp_lock_t lck;
omp_init_lock(&lck);
#pragma omp parallel private(tmp, id)
{
    id = omp_get_thread_num();
    tmp = do_lots_of_work(id);
    omp_set_lock(&lck);           // захват (блокирующий)
    printf("%d %d", id, tmp);
    omp_unset_lock(&lck);         // освобождение
}
omp_destroy_lock(&lck);
```
Жизненный цикл: `omp_init_lock → omp_set_lock / omp_unset_lock → omp_destroy_lock`. Locks — более низкий уровень, чем critical. **[доп.]** `omp_test_lock` — неблокирующая попытка захвата.

## 9. Tasks

Механизм **динамического порождения работы**, похожий на thread pool. Подходит для рекурсии и нерегулярных структур.
```c
int fib(int n) {
    int i, j;
    if (n < 2) return n;
    else {
        #pragma omp task shared(i) firstprivate(n)
        i = fib(n-1);
        #pragma omp task shared(j) firstprivate(n)
        j = fib(n-2);
        #pragma omp taskwait
        return i + j;
    }
}
```
- `task` создаёт задачу, её выполнит какой-либо поток команды.
- `taskwait` ждёт завершения **всех дочерних задач текущей задачи**.
- Data sharing работает как раньше. `i`, `j` должны быть **shared**, иначе результат задачи потеряется в private-копии. `n` — **firstprivate**, то есть значение захватывается при создании задачи.
- **`if` clause:** `#pragma omp task shared(i) if(n > 20)`. Задача создаётся как отложенная **только при n > 20**, иначе выполняется сразу (undeferred). Так избегают overhead на мелких задачах.
- **[доп.]** fib обычно вызывают внутри `#pragma omp parallel` + `#pragma omp single`, чтобы дерево задач породил один поток.

## 10. Dynamic adjustment of threads

OpenMP может **сам менять число потоков** (dynamic adjustment). Чтобы отключить:
```c
#include <omp.h>
void main() {
    int num_threads;
    omp_set_dynamic(0);                         // запрет динамической подстройки
    omp_set_num_threads(omp_get_num_procs());   // на слайде: omp_num_procs()
    #pragma omp parallel
    {
        int id = omp_get_thread_num();
        #pragma omp single
        num_threads = omp_get_num_threads();    // записывает один поток
        do_lots_of_stuff(id);
    }
}
```
`omp_get_num_threads()` вне параллельного региона возвращает 1, поэтому число потоков узнают **внутри** региона, в `single`.

## 11. Summary (со слайда)

- OpenMP упрощает multithreading в C/C++/Fortran.
- Параллельные блоки задаются **preprocessor directives**. Есть **parallel for**.
- **Tasks** — абстракция над потоками.
- **Race conditions и synchronization** нужно обрабатывать **вручную** (как в Java).

### Шпаргалка
| Конструкция | Суть |
|---|---|
| `parallel` | fork команды потоков, implicit barrier в конце |
| `for` / `parallel for` | распределить итерации цикла |
| `sections` / `section` | разные блоки кода параллельно |
| `single` | один поток, implicit barrier |
| `master` | только поток 0, без барьера |
| `critical [(name)]` | взаимное исключение для блока |
| `atomic` | атомарное обновление одной переменной |
| `barrier` | все ждут всех |
| `task` / `taskwait` | динамические задачи / ждать дочерние |
| clauses | `shared, private, firstprivate, lastprivate, reduction(op:var), collapse(n), schedule(kind,chunk), nowait, if(...), num_threads(n)` |
