# Лекция 05: Concurrency in Java — Executors, Fork/join framework, bounded buffers, semaphores/mutexes

Слайды: session5.pdf; код: code\session5lecturecode\concurrent5\src\concurrent5\ (ExecutorAndRunnable, ExecutorAndCallable, CustomRecursiveTask, SortTask)

## Зачем: недостатки "голых" Thread

- Число потоков выбирается вручную и **не связано с числом ядер**.
- Нагрузка на ядра может быть **несбалансированной**.
- Задачи **привязаны к потокам**.
- Остановка потока: `Thread.stop()` и т.п. deprecated (см. Oracle "threadPrimitiveDeprecation" — там же про InterruptedException); правильно — кооперативно через `interrupt()`.

## ExecutorService (Java 1.5, `java.util.concurrent`)

- Держит **pool of threads** и автоматически распределяет задачи по ним.
- Создаётся через фабрику `Executors`:
```java
ExecutorService e1 = Executors.newSingleThreadExecutor();   // 1 worker thread, unbounded queue
ExecutorService e2 = Executors.newFixedThreadPool(10);      // фикс. число потоков, shared unbounded queue
ExecutorService e3 = Executors.newScheduledThreadPool(10);  // запуск с задержкой / периодически
// также newCachedThreadPool() и др.
```
- **Обязательно `shutdown()`** — иначе потенциальная утечка памяти (и JVM может не завершиться).
  - `shutdown()` — новые задачи не принимаются, **уже отправленные доделываются**.
  - `shutdownNow()` — немедленно (прерывает; обычно нежелательно).
- Задачи — `Runnable` или `Callable`.
  - **Runnable** — тот же интерфейс, что для Thread ⇒ один объект можно запустить как Thread или отдать executor'у. `execute(Runnable)` — без результата (`submit(Runnable)` тоже возможен — Future<?> с null).
  - **Callable<V>** — `V call() throws Exception`; **возвращает результат и может бросать checked exceptions**; нельзя напрямую передать в Thread.

```java
public class ExecutorAndCallable implements Callable<String> {
    public String call() throws Exception {
        Thread.sleep(1000);
        return Thread.currentThread().getName();   // напр. "pool-1-thread-1"
    }
}
ExecutorService executor = Executors.newFixedThreadPool(10);
Future<String> future = executor.submit(new ExecutorAndCallable());
System.out.println(new Date() + "::" + future.get());   // get() блокирует до результата
executor.shutdown();
```
- `Future<V>` — тип совпадает с Callable.
- **`get()` блокирующий** ⇒ варианты:
  - таймаут: `future.get(200, TimeUnit.MILLISECONDS)` (бросит TimeoutException);
  - проверка `isDone()`;
  - отмена `cancel(boolean mayInterruptIfRunning)`.
  - Исключение из call() приходит как `ExecutionException` при `get()`.
- `invokeAll(Collection<Callable>)` — запускает все, возвращает `List<Future>`; `invokeAny(...)` — возвращает результат **одной** успешно завершившейся задачи (остальные отменяются).
- ExecutorAndRunnable: `main` печатает дату сразу, имя потока пула — примерно через 1 с; `shutdown()` не убивает выполняющуюся задачу.

## Fork/Join Framework (Java 1.7)

- Встроенный **divide and conquer**: fork (divide) и join (conquer) делает фреймворк, но **как делить — говорим мы**, и до "идеальной" точки (THRESHOLD).
- **ForkJoinPool** — ядро. Потоков обычно = **числу ядер**. Принимает задачи типа `ForkJoinTask<V>`.
- **Work-stealing**:
  - у каждого потока своя **double-ended queue (deque)**; работает над задачами своей очереди;
  - при **fork** новые задачи кладутся в **head своей** очереди;
  - если работы нет — **крадёт с tail чужой** очереди (или берёт из общей (general) очереди пула);
  - такая схема push/steal оптимизирует **locality** и минимизирует **lock contention**.
- Пишут обычно:
  - **RecursiveAction** — `void compute()`, ничего не возвращает;
  - **RecursiveTask<V>** — `V compute()` возвращает результат.
  - Напрямую `ForkJoinTask` реализуют редко.
- `compute()` либо считает сам (маленькая задача), либо делит.
- `join()` ждёт результат подзадачи — это существенно; но он **не должен блокировать поток**: поток, выполняющий join, остаётся доступен для другой работы.
- THRESHOLD определяет, сколько будет задач. Фреймворк "старается", но тонкие улучшения балансировки — на программисте (см. класс Applyer в доках RecursiveAction).

RecursiveTask (CustomRecursiveTask):
```java
class CustomRecursiveTask extends RecursiveTask<Integer> {
    private int[] arr; static final int THRESHOLD = 20;
    protected Integer compute() {
        if (arr.length > THRESHOLD)
            return ForkJoinTask.invokeAll(createSubtasks())   // 2 половины через Arrays.copyOfRange
                    .stream().mapToInt(ForkJoinTask::join).sum();
        else
            return Arrays.stream(arr).filter(a -> a > 10 && a < 27).map(a -> a * 10).sum();
    }
}
```

RecursiveAction (SortTask — merge sort из доков Oracle):
```java
protected void compute() {
    if (hi - lo < THRESHOLD) sortSequentially(lo, hi);   // Arrays.sort
    else {
        int mid = (lo + hi) >>> 1;
        invokeAll(new SortTask(array, lo, mid), new SortTask(array, mid, hi));
        merge(lo, mid, hi);        // <- merge после invokeAll (invokeAll ждёт обе подзадачи)
    }
}
// запуск:
ForkJoinPool pool = ForkJoinPool.commonPool();
pool.execute(action); action.join();      // или pool.invoke(task)
```
- "Где merge?" — сразу после `invokeAll` в той же `compute()`, на каждом уровне рекурсии.
- "Почему main — плохой пример?" — массив из 7 элементов < THRESHOLD = 1000 ⇒ просто последовательный `Arrays.sort`, никакого параллелизма (накладные расходы без пользы).
- Подзадачи SortTask работают над **разными диапазонами одного массива** — нет гонок; CustomRecursiveTask копирует половины (проще, но лишняя память).

## Bounded Buffer (producer–consumer)

- Типичная ситуация producer/consumer: `cat test.txt | grep "test"` — обычно два потока с разной, непостоянной скоростью ⇒ нужен буфер, но не бесконечно растущий.
- **Bounded buffer** — буфер с максимальным размером: **полный ⇒ producer останавливается, пустой ⇒ consumer останавливается**; в промежутке оба заняты.
- В Java (по слайдам) нет стандартной реализации; вариант — массив + два указателя (start/end, кольцевой буфер) или двусвязный список.
- Обязан быть **thread-safe**: минимум 2 потока читают и пишут, может быть несколько producers/consumers.
- (Уточнение) На практике готовое поведение bounded buffer даёт `BlockingQueue` (`ArrayBlockingQueue(capacity)`: `put()` блокирует при полной, `take()` — при пустой).

Классическая реализация на мониторе:
```java
class BoundedBuffer<T> {
    private final Object[] buf; private int head, tail, count;
    BoundedBuffer(int n) { buf = new Object[n]; }
    public synchronized void put(T x) throws InterruptedException {
        while (count == buf.length) wait();          // full → producer ждёт
        buf[tail] = x; tail = (tail + 1) % buf.length; count++;
        notifyAll();
    }
    public synchronized T take() throws InterruptedException {
        while (count == 0) wait();                   // empty → consumer ждёт
        T x = (T) buf[head]; head = (head + 1) % buf.length; count--;
        notifyAll();
        return x;
    }
}
```

## Semaphores and Mutexes

- Semaphores и mutexes — конструкции **уровня ОС**; могут синхронизировать **процессы** (не только потоки).
- В Java есть класс **`Semaphore`**: инициализируется числом permits; потоки делают `acquire()`; работает для до x потоков, остальные ждут, пока кто-то сделает `release()`. Как lock, но пускает **больше одного потока** в critical section (пример: connection pool).
```java
Semaphore sem = new Semaphore(3);
sem.acquire();
try { useConnection(); } finally { sem.release(); }
```
- **Mutex** (mutual exclusion, "mutex semaphore") — отдельного класса в Java нет; **Semaphore(1)** делает то же.
- Lock vs mutex: в Java разницы по сути нет; в C можно иметь **system-wide mutex**, разделяемый между процессами.
- (Уточнение) отличие Semaphore от Lock: у семафора нет "владельца" — release может сделать другой поток; ReentrantLock отпускает только владелец и допускает повторный захват тем же потоком.

## Summary
- ExecutorService упрощает выполнение задач. Fork/join ещё и балансирует нагрузку. Mutexes и semaphores — в основном конструкции уровня ОС.
