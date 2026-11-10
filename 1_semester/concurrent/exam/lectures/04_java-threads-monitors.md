# Лекция 04: Concurrency in Java — Basics, processes, threads, object monitors, memory model

Слайды: session4.pdf; код: code\session4lecturecode\lecture4\src\concurrent4\ (Thread1–4, CounterMain, TestList, BusyWaitingApp/Producer/Consumer)

## Модель

- Java поддерживает concurrency с самого начала. Модель **shared memory**: Java-процесс запускает несколько потоков, которые разделяют память процесса (но не других процессов).

## Process vs Thread

- **Process** — запущенная программа (одна программа может быть запущена несколько раз). Имеет свою память и ресурсы, процессы **изолированы**, управляет ОС. В multi-tasking ОС планирует процессы по ядрам и time slices (**pre-emptive multi-tasking**).
- **Thread** — поток внутри процесса. **Разделяют память (heap)**, но у каждого свой **program counter, stack, local variables**. Пример пользы: текстовый редактор не блокируется во время подготовки к печати.
- Java использует потоки ОС (с Java 1.2; до этого — "green threads").
- Обычная программа: поток `main` (`Thread.currentThread().getName()` → `main`), но `ps -eLf` показывает **много потоков** — их создаёт JVM.

## Создание потоков

```java
// 1) extends Thread, override run()
class MyThread extends Thread {
    @Override public void run() { System.out.println("thread in run"); }
}
Thread t = new MyThread();
t.start();   // НЕ run()!
t.join();    // main ждёт завершения t

// 2) implements Runnable — можно ещё наследовать свой класс
Thread t = new Thread(new MyRunnable()); t.start();

// 3) anonymous class (join невозможен — нет ссылки)
new Thread() { public void run() { ... } }.start();

// 4) lambda (Java 8)
Runnable r = () -> { ... };
new Thread(r).start();
new Thread(() -> doWork()).start();
```
- `start()` делает поток **готовым** к запуску; когда реально выполнится `run()` — решает ОС (на ПК обычно сразу на свободном ядре). Вызов `run()` напрямую выполнит код **в текущем потоке** — нового потока не будет.
- `join()` — вызывающий поток переходит в waiting до завершения другого потока.
- `Thread.sleep(ms)` бросает checked `InterruptedException` — надо ловить или пробрасывать.

## Thread states (диаграмма Baeldung)

- **New** → `start()` → **Runnable** (внутри: Ready to Run ⇄ Running — scheduled/suspended) → exit → **Terminated**.
- **Timed Waiting**: `sleep(time)`, `wait(timeout)`, `join(timeout)`, `parkNanos`, `parkUntil` → назад по истечении времени или `notify()/notifyAll()`.
- **Waiting**: `wait()`, `join()`, `park()` → назад по `notify()/notifyAll()` (или завершению потока для join).
- **Blocked**: ожидание **object monitor** (вход в synchronized) → назад, когда monitor lock получен.

## Non-determinism

- Thread3: main и поток печатают по 4 строки с `sleep(100)` — порядок **разный от запуска к запуску**. Non-determinism — важный "побочный эффект" concurrency, сильно усложняет программирование.

## Race condition и synchronized

CounterMain: 4 потока × 10 000 `++count` на общем `Counter` ⇒ результат например **37014 вместо 40000**.
- `++count` **не атомарен**: read–modify–write, т.е. `newvar = count + 1; count = newvar;` — выполнения потоков "перекрываются", инкременты теряются (lost update).
- **Race condition** — результат программы зависит от порядка выполнения инструкций (расписания), который мы не контролируем.
- (Общие термины, кратко) **Atomic** операция — выполняется целиком, другие потоки не видят промежуточного состояния. **Critical section** — участок кода с доступом к общим данным, который одновременно должен выполнять только один поток. **Mutual exclusion** — гарантия этого (synchronized, Lock).

```java
public synchronized void incrementCount() { ++count; }   // 40000
// или блок с явным monitor object:
public void incrementCount() { synchronized (this) { ++count; } }
```
- `synchronized`: только **один поток на monitor object** может выполнять блок. Synchronized-метод неявно использует `this` (для static — объект класса).
- Поток, не получивший monitor, переходит в состояние **Blocked**.
- synchronized имеет небольшой overhead, но **при сомнениях лучше использовать** — проблемы бывают совсем неочевидны.
- **Code reordering** (слайд 21): `a=2, flg=false`; Thread1: `a = 1; flg = true;` Thread2: `if (flg) println(a);` — может напечатать **a = 2**: компилятор/CPU могут переставить записи, а без синхронизации нет гарантии видимости.
- Замечание (код): в CounterMain `getCount()` не synchronized — работает, т.к. читается после `join()` (join даёт видимость).

## Explicit locking

```java
private Lock myLock = new ReentrantLock();
public void methodToSynchronize() {
    myLock.lock();
    try { /* work */ } finally { myLock.unlock(); }   // на слайде без try/finally; finally — хорошая практика
}
```
- Преимущества: настройка **fairness policy** (`new ReentrantLock(true)`), `tryLock` (с таймаутом — лекция 06). Но `synchronized` используется намного чаще.

## Thread safety коллекций

- Стандартные коллекции (ArrayList, HashMap...) **не thread-safe** — могут прийти в несогласованное состояние. Исключения: старые **Vector** и **Hashtable**.
- TestList: 2 потока добавляют по 100 элементов в общий ArrayList ⇒ "всякие неожиданные результаты" (размер < 200, null-элементы, ArrayIndexOutOfBoundsException). Причина: при переполнении внутреннего массива создаётся новый, содержимое копируется, затем добавляется элемент — **операция не атомарна**.
- Решения:
  - synchronized wrapper: `List<String> safeList = Collections.synchronizedList(new ArrayList<>());`
  - thread-safe коллекции из `java.util.concurrent` (разные реализации со своими плюсами; напр. ConcurrentHashMap, CopyOnWriteArrayList). Wrapper обычно **менее эффективен**.

## Busy waiting, wait/notify

- **Busy waiting** тратит CPU без пользы. BusyWaitingApp: Consumer крутит `while (producer.isBusy()) print(...)` пока Producer генерирует UUID; `isBusy` — **volatile** (иначе Consumer мог бы не увидеть изменение).
- Избегать циклов ожидания другого потока. `wait()` переводит поток в **Waiting**, будится `notify()` / `notifyAll()` — гораздо экономнее.
- `sleep()` похож, но **не освобождает lock**; `wait()` освобождает monitor.
- (Уточнение API) `wait/notify` вызываются только внутри `synchronized` на том же объекте, иначе `IllegalMonitorStateException`; `wait()` принято вызывать в цикле `while (!condition) wait();` (spurious wakeups).

```java
synchronized (lock) { while (!ready) lock.wait(); /* use */ }
synchronized (lock) { ready = true; lock.notifyAll(); }
```

## Java Memory Model

- Память процесса общая для процесса, но **у потоков есть свои области** — память доступа и **visibility** переменных — не одно и то же.
- **Stack** (у каждого потока): информация о выполняемом коде и **локальные примитивные переменные**; ссылки на объекты — тоже локальны.
- **Heap**: **все объекты**, включая примитивные поля объектов. Любой поток, имеющий ссылку, может обратиться к объекту. Программа не управляет heap/stack.
- Hardware: данные могут быть в регистрах, кэшах, RAM ⇒ проблема: переменная обновлена в кэше одного CPU, а другой поток на другом CPU читает старое значение из RAM.
- **volatile** — переменная всегда читается/пишется из/в RAM ⇒ согласованность (**visibility**). **Не даёт mutual exclusion** (`volatile int count; count++` — всё ещё race).
- **synchronized** — и visibility, и **mutual exclusion**.
- **Atomic variables** (`AtomicInteger` и др., `java.util.concurrent.atomic`) — visibility + **атомарные операции** (`incrementAndGet()`, `compareAndSet()`).
- (Уточнение, не на слайдах) формально это описывается отношением **happens-before**: unlock монитора → последующий lock того же монитора; запись volatile → последующее чтение; `start()` → действия потока; действия потока → успешный `join()`.

## Обмен данными между потоками

- Передать данные через **конструктор** (примитивы передаются **по значению**).
- Метод, возвращающий результат, вызываемый стартером **после завершения** потока:
```java
public class Foo implements Runnable {
    private volatile int value;
    public void run() { value = 2; }
    public int getValue() { return value; }
}
Foo foo = new Foo(); Thread th = new Thread(foo);
th.start(); th.join(); int v = foo.getValue();
```
- Элегантнее — futures/promises (лекции 05–06).

## Conclusion
- Потоки: Thread или Runnable. Race conditions контролируются синхронизацией. В многопоточных программах — thread-safe классы. Memory model может давать несогласованность — помогает volatile.
