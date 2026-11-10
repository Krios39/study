# Карточки — Лекция 04: Concurrency in Java — Basics, processes, threads, object monitors, memory model

<details>
<summary><b>Q:</b> Process vs thread?</summary>

- **Process** — запущенная программа; своя память и ресурсы, изолирован, управляется ОС.
- **Thread** — внутри процесса; потоки **делят память (heap)**, но у каждого свой program counter, stack и локальные переменные.

</details>

<details>
<summary><b>Q:</b> Что такое pre-emptive multi-tasking?</summary>

ОС сама назначает процессы ядрам и выделяет им time slices, может прервать выполнение в любой момент.

</details>

<details>
<summary><b>Q:</b> Сколько потоков у простейшей Java-программы, печатающей имя текущего потока?</summary>

Наш код работает в потоке **main**, но JVM создаёт **много** служебных потоков (видно через `ps -eLf`).

</details>

<details>
<summary><b>Q:</b> Два способа создать поток в Java? Преимущество второго?</summary>

1. `class MyThread extends Thread { public void run(){...} }` → `new MyThread().start()`
2. `class R implements Runnable { public void run(){...} }` → `new Thread(new R()).start()`

Runnable: класс может наследовать **свой** класс (в Java одно наследование). Также anonymous class и lambda: `new Thread(() -> ...).start()`.

</details>

<details>
<summary><b>Q:</b> Чем `t.start()` отличается от `t.run()`?</summary>

- `start()` создаёт новый поток и делает его готовым к запуску; когда выполнится `run()` — решает ОС.
- `run()` — обычный вызов метода **в текущем потоке**, никакого параллелизма.

</details>

<details>
<summary><b>Q:</b> Что делает `join()`?</summary>

Вызывающий поток (напр. main) переходит в waiting, пока поток t не завершится. Есть `join(timeout)`.

</details>

<details>
<summary><b>Q:</b> Почему нельзя сделать join для `new Thread(){ public void run(){...} }.start();`?</summary>

Нет ссылки на объект потока (anonymous class создан и сразу запущен) — не на чем вызывать `join()`.

</details>

<details>
<summary><b>Q:</b> Перечислите состояния Java-потока.</summary>

New → (start) → Runnable (Ready ⇄ Running) → Terminated; плюс Non-runnable: **Blocked** (ждёт monitor), **Waiting** (`wait()`, `join()`, `park()`), **Timed Waiting** (`sleep(t)`, `wait(t)`, `join(t)`, `parkNanos`, `parkUntil`).

</details>

<details>
<summary><b>Q:</b> В каком состоянии поток, который ждёт входа в synchronized-блок? А после `wait()`? А в `sleep(100)`?</summary>

- synchronized: **Blocked**.
- `wait()`: **Waiting** (до notify/notifyAll).
- `sleep(100)`: **Timed Waiting**.

</details>

<details>
<summary><b>Q:</b> main и поток печатают "main 1..4" и "thread in run 1..4" с `sleep(100)` между строками. Каков вывод?</summary>

**Non-deterministic**: строки каждого потока идут по порядку, но их чередование меняется от запуска к запуску. Это важный "побочный эффект" concurrency.

</details>

<details>
<summary><b>Q:</b> 4 потока по 10 000 раз делают `++count` на общем счётчике без синхронизации. Что напечатается?</summary>

Обычно **меньше 40000** (напр. 37014): `++count` не атомарен (read → +1 → write, т.е. `newvar = count+1; count = newvar;`), выполнения перекрываются, инкременты теряются. Race condition.

</details>

<details>
<summary><b>Q:</b> Определение race condition (по слайдам).</summary>

Результат программы зависит от порядка (расписания) выполнения инструкций, который мы не контролируем.

</details>

<details>
<summary><b>Q:</b> Что такое atomic операция и critical section?</summary>

- **Atomic** — выполняется целиком, другие потоки не видят промежуточного состояния.
- **Critical section** — код с доступом к общим данным, который одновременно может выполнять только один поток (mutual exclusion).

</details>

<details>
<summary><b>Q:</b> Как исправить счётчик? Два варианта с synchronized.</summary>

```java
public synchronized void incrementCount() { ++count; }
// или
public void incrementCount() { synchronized (this) { ++count; } }
```
Ещё вариант — `AtomicInteger.incrementAndGet()`.

</details>

<details>
<summary><b>Q:</b> Что гарантирует synchronized? Какой monitor у synchronized-метода?</summary>

Только **один поток на monitor object** выполняет блок + видимость изменений. У instance-метода monitor — `this` (у static — объект класса). Не получивший monitor поток — **Blocked**.

</details>

<details>
<summary><b>Q:</b> Два потока вызывают synchronized-методы `m1()` и `m2()` одного объекта. Могут ли они выполняться одновременно? А на разных объектах?</summary>

На **одном** объекте — нет (общий monitor `this`). На **разных** объектах — да (разные мониторы).

</details>

<details>
<summary><b>Q:</b> Стоит ли использовать synchronized, если не уверен, что он нужен?</summary>

По слайдам — да: overhead небольшой, а проблемы бывают совсем неочевидны (напр. code reordering).

</details>

<details>
<summary><b>Q:</b> a=2, flg=false. T1: `a = 1; flg = true;` T2: `if (flg) println(a);`. Что может напечатать T2?</summary>

Ничего, `1` или даже **`2`** — без синхронизации записи могут быть переупорядочены (code reordering) и/или не видны другому потоку. Решение: synchronized или `volatile flg`.

</details>

<details>
<summary><b>Q:</b> ReentrantLock: как использовать и чем лучше synchronized?</summary>

```java
Lock lock = new ReentrantLock();
lock.lock();
try { ... } finally { lock.unlock(); }
```
Преимущества: настраиваемая **fairness policy** (`new ReentrantLock(true)`), `tryLock` с таймаутом. Но synchronized используется гораздо чаще.

</details>

<details>
<summary><b>Q:</b> Что не так с `myLock.lock(); doWork(); myLock.unlock();`?</summary>

Если `doWork()` бросит исключение, `unlock()` не выполнится и lock останется захваченным навсегда. Нужно `try { ... } finally { unlock(); }`.

</details>

<details>
<summary><b>Q:</b> Являются ли стандартные коллекции thread-safe?</summary>

Нет (ArrayList, HashMap и т.д.). Исключения — старые **Vector** и **Hashtable**.

</details>

<details>
<summary><b>Q:</b> Два потока добавляют по 100 чисел в общий ArrayList. Будет ли в конце 200 элементов?</summary>

Не обязательно: возможны меньший размер, null-элементы, `ArrayIndexOutOfBoundsException`. `add` не атомарен — при переполнении создаётся новый массив, копируется содержимое, потом добавляется элемент.

</details>

<details>
<summary><b>Q:</b> Как сделать список безопасным для многопоточности?</summary>

- `Collections.synchronizedList(new ArrayList<>())` — synchronized wrapper (обычно менее эффективен).
- Thread-safe коллекции из `java.util.concurrent` (напр. CopyOnWriteArrayList, ConcurrentHashMap).

</details>

<details>
<summary><b>Q:</b> Что такое busy waiting и почему это плохо? Альтернатива?</summary>

Цикл, крутящийся в ожидании другого потока (`while (producer.isBusy()) {...}`) — тратит CPU без пользы. Альтернатива: `wait()` (поток в состоянии Waiting) + `notify()/notifyAll()` из другого потока.

</details>

<details>
<summary><b>Q:</b> `sleep()` vs `wait()`?</summary>

- `sleep()` — пауза, **не освобождает lock**; метод Thread.
- `wait()` — **освобождает monitor** и ждёт `notify()`; метод Object, вызывается только внутри synchronized на том же объекте (иначе IllegalMonitorStateException).

</details>

<details>
<summary><b>Q:</b> Почему `wait()` принято вызывать в цикле `while`, а не в `if`?</summary>

После пробуждения условие может быть снова ложным (другой поток успел изменить состояние, notifyAll разбудил нескольких, spurious wakeup) ⇒ нужно перепроверить: `while (!cond) wait();`.

</details>

<details>
<summary><b>Q:</b> Java memory model: что лежит в stack, что в heap?</summary>

- **Stack** (свой у каждого потока): информация о выполняемом коде, локальные примитивы, локальные ссылки.
- **Heap**: все объекты, включая их примитивные поля. Любой поток со ссылкой может обращаться к объекту.

</details>

<details>
<summary><b>Q:</b> Почему в shared memory системе может возникнуть проблема видимости?</summary>

Переменная может жить в регистре/кэше одного CPU: поток обновил её в кэше, а поток на другом CPU читает старое значение из RAM. Доступ к памяти ≠ видимость переменной.

</details>

<details>
<summary><b>Q:</b> Что гарантирует volatile и чего не гарантирует?</summary>

- Гарантирует **visibility**: всегда читается/пишется из/в основную память.
- **Не** даёт mutual exclusion / атомарности: `volatile int c; c++;` — всё ещё race condition.

</details>

<details>
<summary><b>Q:</b> volatile vs synchronized vs atomic variables?</summary>

- volatile — только visibility.
- synchronized — visibility + mutual exclusion.
- Atomic (`AtomicInteger`...) — visibility + атомарные операции (`incrementAndGet`, `compareAndSet`) без блокировок.

</details>

<details>
<summary><b>Q:</b> Зачем `private volatile boolean isBusy` в Producer (BusyWaitingApp)?</summary>

Consumer в цикле читает `isBusy`, Producer в другом потоке ставит его в false. Без volatile Consumer может никогда не увидеть изменение (значение закэшировано) и крутиться вечно.

</details>

<details>
<summary><b>Q:</b> Что такое happens-before (кратко)?</summary>

Отношение Java Memory Model: если A happens-before B, то эффекты A видны в B. Примеры: unlock монитора → последующий lock того же монитора; запись volatile → её последующее чтение; `start()` → действия нового потока; все действия потока → успешный `join()` на нём.

</details>

<details>
<summary><b>Q:</b> Как передать данные в поток и получить результат (по слайдам)?</summary>

- Вход — через конструктор (примитивы по значению).
- Результат — поле + getter, который вызывается после `join()`:
```java
Foo foo = new Foo(); Thread t = new Thread(foo);
t.start(); t.join(); int v = foo.getValue();
```
Элегантнее — futures/promises.

</details>

<details>
<summary><b>Q:</b> В CounterMain `getCount()` не synchronized, а `incrementCount()` — synchronized. Корректен ли итог?</summary>

Да: `getCount()` вызывается в main **после join()** всех потоков, а join гарантирует видимость их изменений. Если бы читали во время работы потоков — значение могло бы быть устаревшим.

</details>

<details>
<summary><b>Q:</b> Что такое "green threads" и с какой версии Java использует потоки ОС?</summary>

Green threads — потоки, реализованные самой JVM (до Java 1.2). С Java 1.2 используются потоки ОС.

</details>
