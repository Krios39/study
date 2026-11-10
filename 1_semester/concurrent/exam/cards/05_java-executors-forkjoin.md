# Карточки — Лекция 05: Concurrency in Java — Executors, Fork/join framework

<details>
<summary><b>Q:</b> Какие недостатки прямого использования Thread решает ExecutorService?</summary>

- Число потоков выбирается вручную, не связано с числом ядер.
- Нагрузка на ядра может быть несбалансированной.
- Задачи привязаны к потокам.

ExecutorService держит pool потоков и сам распределяет задачи.

</details>

<details>
<summary><b>Q:</b> Как создаются ExecutorService? Назовите 3 фабричных метода.</summary>

Через класс `Executors`:
- `newSingleThreadExecutor()` — один worker thread, unbounded queue;
- `newFixedThreadPool(n)` — фиксированное число переиспользуемых потоков, общая unbounded queue;
- `newScheduledThreadPool(n)` — запуск с задержкой или периодически.

</details>

<details>
<summary><b>Q:</b> Что будет, если не вызвать shutdown()?</summary>

Потоки пула продолжают жить — потенциальная утечка памяти (memory leak), программа может не завершиться.

</details>

<details>
<summary><b>Q:</b> shutdown() vs shutdownNow()?</summary>

- `shutdown()` — новые задачи не принимаются, уже отправленные **доделываются**.
- `shutdownNow()` — останавливает немедленно (обычно нежелательно).

</details>

<details>
<summary><b>Q:</b> Runnable vs Callable?</summary>

- Runnable: `void run()`, без результата, без checked exceptions; можно запустить как Thread или в executor (`execute()`).
- Callable<V>: `V call() throws Exception` — **возвращает результат** и может бросать исключения; **нельзя** напрямую передать в Thread, только в executor через `submit()`.

</details>

<details>
<summary><b>Q:</b> execute() vs submit()?</summary>

- `execute(Runnable)` — ничего не возвращает.
- `submit(Callable<V>)` → `Future<V>` с результатом (`submit(Runnable)` тоже есть — Future с null).

</details>

<details>
<summary><b>Q:</b> Что такое Future и какие у него методы?</summary>

Placeholder для результата асинхронной задачи (тип = тип Callable). `get()` — блокирует до результата; `get(timeout, unit)`; `isDone()`; `cancel(boolean mayInterruptIfRunning)`.

</details>

<details>
<summary><b>Q:</b> Почему `future.get()` может быть проблемой и что делать?</summary>

Блокирует вызывающий поток до завершения задачи (возможно, надолго). Варианты: `get(200, TimeUnit.MILLISECONDS)` (TimeoutException), проверять `isDone()`, отменять `cancel(...)`.

</details>

<details>
<summary><b>Q:</b> Что напечатает ExecutorAndCallable (sleep 1 с, return имя потока; main печатает `new Date()+"::"+future.get()`)?</summary>

Примерно через 1 с: дата + `::pool-1-thread-1` — задача выполнялась в потоке пула, main ждал в `get()`.

</details>

<details>
<summary><b>Q:</b> invokeAll vs invokeAny?</summary>

Оба принимают коллекцию Callable.
- `invokeAll` — выполняет все, возвращает `List<Future>`.
- `invokeAny` — возвращает результат одной успешно завершившейся задачи.

</details>

<details>
<summary><b>Q:</b> Как сообщается исключение, брошенное внутри call()?</summary>

При `future.get()` оно приходит обёрнутым в `ExecutionException` (поэтому main в примере `throws ExecutionException`).

</details>

<details>
<summary><b>Q:</b> Что такое fork/join framework, с какой версии Java?</summary>

Java 1.7. Встроенный **divide and conquer**: fork (разделить) и join (собрать) выполняет фреймворк, но как делить и до какого порога — задаёт программист.

</details>

<details>
<summary><b>Q:</b> Сколько потоков у ForkJoinPool и какие задачи он принимает?</summary>

Обычно = **числу ядер**. Принимает `ForkJoinTask<V>`; на практике — `RecursiveAction` или `RecursiveTask<V>`.

</details>

<details>
<summary><b>Q:</b> Объясните work-stealing.</summary>

У каждого потока своя **double-ended queue**. Поток берёт задачи из своей очереди; при fork новые задачи кладутся в **head** своей очереди; если своя пуста — крадёт с **tail** чужой очереди (или из общей очереди пула). Оптимизирует locality и минимизирует lock contention.

</details>

<details>
<summary><b>Q:</b> RecursiveAction vs RecursiveTask<V>?</summary>

Оба переопределяют `compute()`.
- RecursiveAction — `void compute()`, без результата (напр. сортировка на месте).
- RecursiveTask<V> — `V compute()`, возвращает результат (напр. сумма).

</details>

<details>
<summary><b>Q:</b> Типичная структура compute()?</summary>

```java
if (size <= THRESHOLD) return computeDirectly();
else { split into subtasks; invokeAll(...) / fork(); combine results via join(); }
```

</details>

<details>
<summary><b>Q:</b> В SortTask: где происходит merge?</summary>

Сразу после `invokeAll(left, right)` в той же `compute()`: invokeAll ждёт обе половины, затем `merge(lo, mid, hi)`. Так на каждом уровне рекурсии.

</details>

<details>
<summary><b>Q:</b> Почему main в SortTask (массив из 7 элементов, THRESHOLD = 1000) — "не хороший пример"?</summary>

7 < 1000 ⇒ сразу `sortSequentially` (Arrays.sort) — никакого параллелизма, только накладные расходы пула.

</details>

<details>
<summary><b>Q:</b> Что определяет THRESHOLD и как его выбирать?</summary>

Порог, ниже которого задача считается последовательно ⇒ определяет число задач. Слишком мал — огромный overhead на создание задач; слишком велик — мало параллелизма/плохой баланс.

</details>

<details>
<summary><b>Q:</b> Блокирует ли `join()` в fork/join поток?</summary>

Задача ждёт результат (это необходимо), но join **не должен блокировать поток** — поток остаётся доступным для другой работы (может выполнять другие задачи, пока ждёт).

</details>

<details>
<summary><b>Q:</b> Решает ли fork/join всю балансировку нагрузки автоматически?</summary>

Нет — фреймворк "старается", но тонкие улучшения (умное деление, как в классе Applyer из доков RecursiveAction) — задача программиста.

</details>

<details>
<summary><b>Q:</b> Что такое bounded buffer и зачем?</summary>

Буфер с максимальным размером между producer и consumer (как `cat file | grep x`): скорости разные и непостоянны, буфер сглаживает, но не растёт бесконечно. Полный ⇒ producer ждёт; пустой ⇒ consumer ждёт.

</details>

<details>
<summary><b>Q:</b> Как реализовать bounded buffer и какое требование обязательно?</summary>

Массив + два указателя (start/end, кольцевой буфер) или двусвязный список. Обязательно **thread-safe** (минимум 2 потока, возможно несколько producers/consumers): synchronized + `while(full) wait()` / `while(empty) wait()` + `notifyAll()`. Готовый вариант — `ArrayBlockingQueue` (`put/take`).

</details>

<details>
<summary><b>Q:</b> В bounded buffer используют `notify()` вместо `notifyAll()` при нескольких producers и consumers. Чем опасно?</summary>

notify будит один произвольный поток — может разбудить "не того" (producer'а, когда буфер полон), тот снова уснёт, а нужный поток не проснётся ⇒ все могут застрять. notifyAll + while-проверка безопаснее.

</details>

<details>
<summary><b>Q:</b> Что такое Semaphore в Java?</summary>

Инициализируется числом permits. `acquire()` — занять (если нет — ждать), `release()` — вернуть. Пускает до x потоков одновременно в critical section (пример: connection pool).

</details>

<details>
<summary><b>Q:</b> Есть ли класс Mutex в Java? Lock vs mutex?</summary>

Нет: mutex (mutual exclusion) = **Semaphore(1)**. В Java разницы между lock и mutex по сути нет; в C mutex может быть system-wide, разделяемым между процессами.

</details>

<details>
<summary><b>Q:</b> Semaphore vs lock — в чём отличие?</summary>

- Semaphore допускает **больше одного** потока; у него нет владельца (release может сделать другой поток).
- Lock — ровно один владелец; ReentrantLock отпускает только захвативший поток.

</details>

<details>
<summary><b>Q:</b> На каком уровне изначально существуют semaphores и mutexes?</summary>

На уровне **ОС** — для синхронизации процессов. В Java-потоках менее актуальны, но существуют.

</details>
