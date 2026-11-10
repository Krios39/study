# Лекция 06: Concurrency in Java — Deadlock, livelock, pitfalls, functional elements, parallel streams, futures and promises

Слайды: session6.pdf; код: code\concurrent6\concurrent6\src\concurrent6\ (Deadlock, DeadlockMethod, LivelockWithLocks, Streams)

## Сложности concurrency
- **Non-deterministic** выполнение — обычное дело.
- Отладка может менять результат программы — **"Heisenbug"**.

## Deadlock

- Deadlock — поток **никогда не завершается** (заблокирован навсегда). На практике трудно отличить от очень долгого потока. Обычно возникает при **взаимодействии двух и более потоков**.
- (Уточнение, не на слайдах) Классические **условия Коффмана** — deadlock возможен только если одновременно: (1) **mutual exclusion**, (2) **hold and wait** (держит ресурс и ждёт другой), (3) **no preemption** (ресурс нельзя отнять), (4) **circular wait** (цикл ожидания). Сломать любое ⇒ deadlock невозможен; единый порядок захвата ломает circular wait.

Классический пример ("crossed" locks):
```java
final String r1 = "deadlock", r2 = "example";
Thread t1 = new Thread() { public void run() {
    synchronized (r2) { System.out.println("Thread 1: Locked r2");
        try { Thread.sleep(100); } catch (InterruptedException e) {}
        synchronized (r1) { System.out.println("Thread 1: Locked r1"); } } } };
Thread t2 = new Thread() { public void run() {
    synchronized (r1) { System.out.println("Thread 2: Locked r1");
        try { Thread.sleep(100); } catch (InterruptedException e) {}
        synchronized (r2) { System.out.println("Thread 2: Locked r2"); } } } };
t1.start(); t2.start();
```
- Обычно печатается "Thread 1: Locked r2", "Thread 2: Locked r1" (в любом порядке) и программа **виснет**.
- **Гарантирован ли deadlock? Нет** — если один поток успеет захватить оба монитора до старта второго, всё завершится. `sleep(100)` делает deadlock практически неизбежным, но не гарантирует.
- Если поменять порядок захвата так, чтобы оба брали в **одном порядке** (r1, потом r2) — deadlock **невозможен**.
- (Уточнение) синхронизация на строковых литералах — плохая практика: литералы interned, тот же объект может использоваться где угодно.

Рекомендации:
- Избегать **nested synchronization** (реальные случаи редки); лучше вообще избегать нескольких синхронизаций в одном потоке.
- Если нужно — потоки должны брать одни и те же locks **в одном порядке**.
- Не делать долгих задач в synchronized-методах, которым синхронизация не нужна.
- **Timeouts**: `join(timeout)`; `Lock.tryLock(time, unit)`; для `synchronized` **таймаута нет**. Но просто игнорировать проблему может вызвать другие.

**Deadlock через synchronized-методы** (DeadlockMethod) — обычно не прямо из кода, но можно сконструировать (довольно искусственно):
```java
class A { synchronized void methodA(B b) { b.last(); }  synchronized void last() {...} }
class B { synchronized void methodB(A a) { a.last(); }  synchronized void last() {...} }
// main thread: a.methodA(b)  — держит монитор a, ждёт монитор b (для b.last())
// new thread : b.methodB(a)  — держит монитор b, ждёт монитор a (для a.last())
```
- Возможен deadlock (не гарантирован — зависит от тайминга).

**Диагностика**: `jstack`, Java Mission Control (JMC), VisualVM, `jcmd`, `jconsole` (GUI и CLI); на Linux `kill -3 <pid>` печатает thread dump; сторонние/коммерческие инструменты. Ищем потоки, **заблокированные (BLOCKED) длительное время**.

## Livelock

- Livelock — поток никогда не завершается, **хотя не заблокирован** (активно работает, но без прогресса). Как и deadlock — от неправильного взаимодействия потоков.
- LivelockWithLocks: два `ReentrantLock(true)` (fair). T1: берёт lock1, спит 50 мс, `lock2.tryLock()`; не удалось ⇒ отпускает lock1 и повторяет. T2 симметрично (lock2, затем lock1). Оба "вежливо" уступают и повторяют синхронно ⇒ бесконечно печатают "cannot acquire ..., releasing ...".
  - (Замечание к коду) результат `lock1.tryLock(50, ms)` игнорируется — если захват не удался, последующий `unlock()` бросит `IllegalMonitorStateException`.
  - Лечение (общее): случайная задержка (random backoff) перед повтором, единый порядок захвата.
- Гораздо чаще на практике: ресурс повторно пытаются получить / ошибочное действие повторяется **бесконечно** (повторная отправка сообщения как единственный вариант, сбой доступа к диску). Это проблема **error handling** — бывает и в однопоточных программах.
- Обнаружение: те же инструменты, что для deadlock; искать потоки, **постоянно активные в одних и тех же строках кода**. Часто очень сложно.

## Другие проблемы

- **Race conditions** — решение: синхронизация или **atomic objects**.
- Thread-safe объекты **не решают всё** — check-then-act:
```java
List<String> list = Collections.synchronizedList(new ArrayList<>());
if (!list.contains("foo")) {   // каждый вызов атомарен, но связка — нет:
    list.add("foo");           // два потока могут оба пройти проверку ⇒ дубликат
}
// исправление: synchronized (list) { if (!list.contains("foo")) list.add("foo"); }
```
- Несколько synchronized-методов синхронизируются **на одном объекте (this)** — часто нежелательно (независимые операции блокируют друг друга; лучше отдельные lock-объекты).
- **Inconsistent object states** — использовать `volatile`, если переменную используют несколько потоков.
- **Не менять объект, на котором синхронизируешься**:
```java
synchronized (foo) { foo = new Foo(); }   // другие потоки синхронизируются уже на другом объекте ⇒ нет взаимного исключения
```

## Functional elements

- Функциональное программирование: всё — чистые математические функции, выход зависит **только от входа**; **нет состояния и side effects**. Чисто функциональные: Haskell; Scala — Java-derived с функциональными элементами (не чисто).
- В Java функции — **first-class citizens** (lambda, method references `Person::getAge`). Отсутствие shared mutable state делает concurrency проще.

## Streams (Stream API)

- Stream — **обёртка вокруг источника данных**; не хранит и не изменяет данные, а делает их доступными для функциональных операций. Не I/O-элемент (но можно с файлами).
- Создание:
```java
listOfNumbers.stream();
Arrays.stream(arr);
Stream.<String>builder().add("a").add("b").build();
IntStream.range(1, 3);          // 1,2
LongStream.rangeClosed(1, 3);   // 1,2,3
new Random().doubles(3);
Stream.iterate(2, i -> i * 2);  // бесконечный stream
// также через Supplier<> (Stream.generate)
```
- Вычисление **lazy** — делается только нужная работа (без terminal operation ничего не выполняется).
- По умолчанию stream **не параллельный**; `list.parallelStream()` (или `.parallel()`) — параллельный (печать `Thread.currentThread().getName()` покажет `main` и `ForkJoinPool.commonPool-worker-N`).

Операции:
- `forEach()` — применить функцию к каждому элементу (terminal); в parallel — **случайный порядок**, для порядка — `forEachOrdered()`.
- `map()` — новый stream, функция к каждому элементу.
- `filter()` — оставляет элементы, для которых predicate (boolean) истинен.
- `collect()` — обратно в List и т.п. (`collect(Collectors.toList())`).
- `flatMap()` — убирает "слой" (`Stream<List<String>>` → `Stream<String>`); функция может вернуть несколько значений.
- `peek()` — как forEach, но **не terminal** (для отладки).
- Агрегаты: `sum(), average(), min(), max(), count()`.
- `skip()`, `limit()`; `allMatch`, `anyMatch`, `noneMatch`.
- `reduce()` — аккумуляция: `integers.stream().reduce(0, (a, b) -> a + b)`. Map + reduce дали имя парадигме MapReduce (но это немного другое).
- `sorted()` — сортировка по comparator — **не lazy** (stateful, нужно увидеть всё).

Примеры:
```java
double avg = roster.parallelStream().filter(p -> p.getGender() == Person.Sex.MALE)
        .mapToInt(Person::getAge).average().getAsDouble();
long n = roster.stream().filter(e -> e.getSalary() > 200000).count();
boolean all = roster.stream().map(p -> p.getName()).allMatch(s -> s.startsWith("A"));
IntStream nv = IntStream.of(1,2,3,4).flatMap(v -> Arrays.asList(v*v, v*v*v, v+1).stream().mapToInt(Integer::intValue));
// nv: 1,1,2, 4,8,3, 9,27,4, 16,64,5
```
- (Замечание к коду Streams.java) `roster` пуст ⇒ `average()` даёт пустой `OptionalDouble`, `getAsDouble()` бросит `NoSuchElementException`.
- Parallel streams используют **fork/join framework** (common pool). Деление данных — **Spliterator** (итератор по chunk'у stream). Обычно явно не нужен.
- (Уточнение) лямбды в parallel stream не должны изменять общее состояние (напр. `list.add` в `forEach` на ArrayList — race); результат `reduce` корректен только с ассоциативной операцией и нейтральным identity.

## Futures, Promises, Delays, Deferreds

- По сути одно и то же (точный смысл зависит от языка): объект — **placeholder для результата, который ещё не готов**. Используются в concurrency, сетевых операциях и т.д.
- В Java (и Scala) различие:
  - **Future** (Java 5) — **read-only** ссылка на ещё не вычисленное значение; читается, когда готово (`executor.submit(callable)`).
  - **CompletableFuture** (Java 8) — по сути Java-**Promise**: можно **завершить вручную** и строить цепочки; сложный, но мощный.

```java
// как обычный Future, завершаемый вручную (promise)
CompletableFuture<String> cf = new CompletableFuture<>();
Executors.newCachedThreadPool().submit(() -> { Thread.sleep(500); cf.complete("Hello"); return null; });
cf.get();   // "Hello"

// асинхронное выполнение
CompletableFuture<String> f = CompletableFuture.supplyAsync(() -> "Hello");   // Supplier, common pool

// callback по завершению
f.thenApply(s -> s + " World");            // возвращает новый CompletableFuture с результатом
// thenAccept(Consumer) / thenRun(Runnable) — не возвращают значение (CompletableFuture<Void>)

// chaining: результат передаётся в следующий async-вызов (как flatMap)
CompletableFuture.supplyAsync(() -> "Hello")
    .thenCompose(s -> CompletableFuture.supplyAsync(() -> s + " World"));

// combine двух независимых
CompletableFuture.supplyAsync(() -> "Hello")
    .thenCombine(CompletableFuture.supplyAsync(() -> " World"), (s1, s2) -> s1 + s2);
// thenAcceptBoth — то же без результата

// много параллельных
CompletableFuture<Void> all = CompletableFuture.allOf(f1, f2, f3);
all.get();   // ждёт всех (результаты брать из f1..f3, напр. join())
```
- **thenApply vs thenCompose**: thenApply(fn: T→U) ⇒ `CF<U>`; если fn возвращает CF, получим `CF<CF<U>>`; thenCompose(fn: T→CF<U>) "сплющивает" в `CF<U>`.
- Обработка ошибок:
  - `handle((result, ex) -> ...)` — получает результат **или** исключение, **может вернуть новый результат**;
  - `whenComplete((result, ex) -> ...)` — получает то же, но **ничего не возвращает** (напр. печать);
  - `exceptionally(ex -> ...)` — выполняется **только при исключении**.

## Project Loom

- Попытка переработать concurrency в Java. Центральное — **virtual threads**: лёгкие потоки внутри JVM, хороши для **IO-heavy** приложений, менее — для compute-intensive.
- **Structured concurrency** — упрощает зависимости между потоками и обработку ошибок.

## Summary
- Concurrency добавляет сложность; deadlocks и livelocks — частые проблемы; хорошие практики минимизируют их, при необходимости — искать инструментами.
- Streams делают параллельный код очень простым.
- CompletableFutures — ещё один способ concurrency в Java: мощный, но сложный.
