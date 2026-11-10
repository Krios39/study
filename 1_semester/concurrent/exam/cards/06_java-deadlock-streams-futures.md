# Карточки — Лекция 06: Concurrency in Java — Deadlock, livelock, functional elements, parallel streams, futures and promises

<details>
<summary><b>Q:</b> Что такое Heisenbug?</summary>

Ошибка, которая исчезает или меняется при отладке — отладка меняет тайминг, а значит и поведение concurrent программы.

</details>

<details>
<summary><b>Q:</b> Определение deadlock (по слайдам).</summary>

Поток никогда не завершается (заблокирован навсегда). Обычно возникает при взаимодействии двух и более потоков; на практике трудно отличить от очень долгого потока.

</details>

<details>
<summary><b>Q:</b> Четыре необходимых условия deadlock (Coffman)?</summary>

1. Mutual exclusion.
2. Hold and wait — держит ресурс и ждёт другой.
3. No preemption — ресурс нельзя отобрать.
4. Circular wait — цикл ожидания.

Сломай любое — deadlock невозможен (не на слайдах, но стандартно).

</details>

<details>
<summary><b>Q:</b> T1: `synchronized(r2){ sleep(100); synchronized(r1){...} }`, T2: `synchronized(r1){ sleep(100); synchronized(r2){...} }`. Что произойдёт? Гарантирован ли deadlock?</summary>

Почти всегда: T1 держит r2 и ждёт r1, T2 держит r1 и ждёт r2 ⇒ deadlock, программа висит после "Thread 1: Locked r2" / "Thread 2: Locked r1". **Не гарантирован**: если один поток захватит оба монитора до того, как второй возьмёт первый — всё завершится. sleep лишь делает deadlock очень вероятным.

</details>

<details>
<summary><b>Q:</b> Как исправить crossed-locks deadlock?</summary>

Захватывать locks **в одном и том же порядке** во всех потоках (оба: r1, затем r2) — тогда deadlock невозможен. Или избегать вложенной синхронизации.

</details>

<details>
<summary><b>Q:</b> Рекомендации по избежанию deadlock (по слайдам)?</summary>

- Избегать nested synchronization; лучше — нескольких синхронизаций в одном потоке.
- Одинаковый порядок захвата locks.
- Не делать долгих задач в synchronized-методах, которым синхронизация не нужна.
- Timeouts: `join(timeout)`, `Lock.tryLock(timeout)`.

</details>

<details>
<summary><b>Q:</b> Можно ли задать timeout для synchronized?</summary>

Нет. Таймаут есть у `Lock.tryLock(time, unit)` и `join(timeout)`.

</details>

<details>
<summary><b>Q:</b> Может ли deadlock возникнуть только из synchronized-методов (без явных synchronized-блоков)?</summary>

Да (искусственно): `A.methodA(B b){ b.last(); }`, `B.methodB(A a){ a.last(); }`, все synchronized. Поток 1: `a.methodA(b)` — держит монитор a, ждёт b. Поток 2: `b.methodB(a)` — держит b, ждёт a ⇒ возможен deadlock.

</details>

<details>
<summary><b>Q:</b> Как найти deadlock в Java-программе?</summary>

Thread dump и мониторинг: `jstack`, `jcmd`, `jconsole`, Java Mission Control (JMC), VisualVM; на Linux `kill -3 <pid>`. Ищем потоки, **заблокированные длительное время**.

</details>

<details>
<summary><b>Q:</b> Deadlock vs livelock?</summary>

- Deadlock: потоки **заблокированы** (Blocked/Waiting), ничего не делают.
- Livelock: поток **не заблокирован**, активно работает, но **без прогресса** (никогда не завершается).

</details>

<details>
<summary><b>Q:</b> Объясните LivelockWithLocks.</summary>

T1 берёт lock1, T2 — lock2; каждый спит 50 мс, затем `tryLock()` другого lock'а неудачен ⇒ отпускает свой и повторяет. Действуя синхронно, они бесконечно уступают друг другу ("cannot acquire lock2, releasing lock1."). Лечение: случайная задержка перед повтором, единый порядок захвата.

</details>

<details>
<summary><b>Q:</b> Какой livelock чаще встречается на практике?</summary>

Бесконечные повторы неудачного действия: повторная отправка сообщения как единственный вариант, повтор неудачного доступа к диску. Это проблема **error handling**, бывает и в однопоточных программах.

</details>

<details>
<summary><b>Q:</b> Как обнаружить livelock?</summary>

Те же инструменты, что для deadlock; искать потоки, постоянно активные в одних и тех же строках кода. Часто очень сложно.

</details>

<details>
<summary><b>Q:</b> Что не так: <code>List&lt;String&gt; list = Collections.synchronizedList(new ArrayList&lt;&gt;()); if (!list.contains("foo")) list.add("foo");</code></summary>

Каждый вызов атомарен, но **связка check-then-act — нет**: два потока могут оба увидеть, что "foo" нет, и оба добавить ⇒ дубликат. Исправление: `synchronized (list) { if (!list.contains("foo")) list.add("foo"); }`.

</details>

<details>
<summary><b>Q:</b> Что не так с `synchronized (foo) { foo = new Foo(); }`?</summary>

Меняется объект, на котором синхронизируются: другие потоки будут синхронизироваться на **новом** объекте ⇒ mutual exclusion теряется. Не менять монитор-объект (лучше `final` поле).

</details>

<details>
<summary><b>Q:</b> Почему плохо, когда много synchronized-методов класса синхронизируются на одном объекте?</summary>

Все они используют монитор `this` ⇒ независимые операции блокируют друг друга, теряется параллелизм. Часто лучше отдельные lock-объекты.

</details>

<details>
<summary><b>Q:</b> Как решаются race conditions (по слайдам "Other problems")?</summary>

Синхронизация или atomic objects; thread-safe объекты полезны, но не решают всё; volatile для переменных, используемых несколькими потоками (inconsistent states).

</details>

<details>
<summary><b>Q:</b> Что такое функциональное программирование и как оно помогает concurrency?</summary>

Программа из чистых функций: выход зависит только от входа, нет состояния и side effects. Функции — first-class citizens. Нет shared mutable state ⇒ нет race conditions ⇒ легко распараллелить. Haskell — чисто функциональный; Scala — с функциональными элементами.

</details>

<details>
<summary><b>Q:</b> Что такое Stream в Java? Хранит ли он данные?</summary>

Обёртка вокруг источника данных (List, массив, Supplier...), делающая его доступным для функциональных операций. Данные **не хранит и не изменяет**. Не путать с I/O-streams.

</details>

<details>
<summary><b>Q:</b> Что значит, что streams lazy? Какая операция не lazy?</summary>

Вычисляется только необходимое и только при terminal operation (поэтому возможны бесконечные `Stream.iterate(2, i -> i*2)` с `limit`). `sorted()` не lazy — нужно увидеть все элементы.

</details>

<details>
<summary><b>Q:</b> Как сделать stream параллельным? Что используется внутри?</summary>

`list.parallelStream()` (или `.parallel()`). Внутри — **fork/join framework** (common pool); данные делит **Spliterator** (итератор по chunk'у).

</details>

<details>
<summary><b>Q:</b> `Arrays.asList(1,2,3,4).parallelStream().forEach(System.out::println)` — в каком порядке?</summary>

В **произвольном** (недетерминированном). Для исходного порядка — `forEachOrdered()`.

</details>

<details>
<summary><b>Q:</b> map vs flatMap?</summary>

- `map` — 1 элемент → 1 элемент.
- `flatMap` — 1 элемент → stream из 0..n элементов, результат "сплющивается" (`Stream<List<String>>` → `Stream<String>`).

</details>

<details>
<summary><b>Q:</b> forEach vs peek?</summary>

Оба применяют функцию к каждому элементу, но `forEach` — terminal (завершает stream), `peek` — intermediate (stream продолжается; удобно для отладки).

</details>

<details>
<summary><b>Q:</b> Что вернёт `IntStream.of(1,2,3,4).flatMap(v -> Arrays.asList(v*v, v*v*v, v+1).stream().mapToInt(Integer::intValue))`?</summary>

1, 1, 2, 4, 8, 3, 9, 27, 4, 16, 64, 5.

</details>

<details>
<summary><b>Q:</b> `Arrays.asList(1,2,3,4,5).stream().reduce(0, (a,b) -> a+b)` — результат? Что важно для reduce в parallel?</summary>

15. В parallel stream операция должна быть **ассоциативной**, а identity (0) — нейтральным, иначе результат зависит от разбиения.

</details>

<details>
<summary><b>Q:</b> Что не так: <code>List&lt;Integer&gt; out = new ArrayList&lt;&gt;(); nums.parallelStream().map(x -&gt; x*2).forEach(out::add);</code></summary>

Side effect в общий не thread-safe ArrayList из нескольких потоков ⇒ race condition (потерянные элементы, исключения), плюс порядок произволен. Правильно: `.collect(Collectors.toList())`.

</details>

<details>
<summary><b>Q:</b> Что такое Future / Promise / Delay / Deferred?</summary>

По сути одно и то же (детали зависят от языка): объект-**placeholder для результата, который ещё не готов**. Используются в concurrency, сетевых операциях и т.д.

</details>

<details>
<summary><b>Q:</b> Future vs CompletableFuture?</summary>

- **Future** (Java 5): read-only ссылка на ещё не вычисленное значение; только `get/isDone/cancel`.
- **CompletableFuture** (Java 8): Java-аналог **Promise** — можно завершить вручную (`complete()`), строить цепочки (`thenApply`, `thenCompose`, `thenCombine`, `allOf`), обрабатывать ошибки. Реализует Future.

</details>

<details>
<summary><b>Q:</b> Как запустить задачу асинхронно через CompletableFuture и получить результат?</summary>

```java
CompletableFuture<String> f = CompletableFuture.supplyAsync(() -> "Hello");
f.get();   // "Hello"
```

</details>

<details>
<summary><b>Q:</b> thenApply vs thenAccept vs thenRun?</summary>

- `thenApply(fn)` — преобразует результат, возвращает новый CompletableFuture с значением.
- `thenAccept(consumer)` — получает результат, ничего не возвращает.
- `thenRun(runnable)` — не получает результат и ничего не возвращает.

</details>

<details>
<summary><b>Q:</b> thenApply vs thenCompose?</summary>

- `thenApply(s -> s + " World")` — функция возвращает значение.
- `thenCompose(s -> CompletableFuture.supplyAsync(() -> s + " World"))` — функция возвращает CompletableFuture; результат "сплющивается" (без `CF<CF<String>>`) — цепочка асинхронных шагов.

</details>

<details>
<summary><b>Q:</b> thenCombine vs allOf?</summary>

- `thenCombine(other, (a,b) -> ...)` — объединяет результаты **двух** независимых futures (`thenAcceptBoth` — без результата).
- `allOf(f1, f2, f3)` — для многих; возвращает `CompletableFuture<Void>`, `get()` ждёт всех (результаты брать из самих f1..f3).

</details>

<details>
<summary><b>Q:</b> handle vs whenComplete vs exceptionally?</summary>

- `handle((res, ex) -> ...)` — результат или исключение, **может вернуть новый результат**.
- `whenComplete((res, ex) -> ...)` — то же, но **ничего не возвращает** (напр. логирование).
- `exceptionally(ex -> ...)` — вызывается **только при исключении** (fallback-значение).

</details>

<details>
<summary><b>Q:</b> Что такое Project Loom и virtual threads? Для чего они подходят?</summary>

Переработка concurrency в Java. **Virtual threads** — лёгкие потоки внутри JVM; хороши для **IO-heavy** приложений, менее — для compute-intensive. **Structured concurrency** упрощает зависимости потоков и обработку ошибок.

</details>

<details>
<summary><b>Q:</b> Parallel streams vs ExecutorService vs CompletableFuture — когда что?</summary>

- Parallel streams — data parallelism над коллекцией без shared state, минимум кода.
- ExecutorService — явный контроль пула и набора независимых задач (Runnable/Callable).
- Fork/join — рекурсивный divide and conquer.
- CompletableFuture — асинхронные цепочки зависимых шагов, комбинирование результатов, обработка ошибок.

</details>
