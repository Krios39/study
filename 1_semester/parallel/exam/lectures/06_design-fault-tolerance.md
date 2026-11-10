# Лекция 06: Parallel Algorithm Design Principles; Fault-tolerance in parallel computing

Слайды: lecture-slides.pdf, стр. 90–101

## Parallel algorithm — что это
- **Sequential algorithm** — рецепт/последовательность базовых шагов решения задачи на serial computer.
- **Parallel algorithm** — рецепт решения задачи на **нескольких процессорах**. Это больше, чем просто перечисление шагов: добавляется **dimension of concurrency** — указание наборов шагов, которые можно выполнять одновременно.
- Примеры, разбираемые далее: matrix-vector multiplication, database query processing.

## Что включает проектирование параллельного алгоритма
Некоторые или все из:
1. **Identifying** порций работы, которые можно выполнять concurrently.
2. **Mapping** concurrent кусков работы на несколько процессов, работающих параллельно.
3. **Distributing** входных, выходных и промежуточных данных программы.
4. **Managing accesses** к данным, разделяемым несколькими процессорами.
5. **Synchronizing** процессоров на разных стадиях выполнения.

## Два ключевых шага
1. **Decomposition** — разбиение вычисления на более мелкие вычисления.
2. **Mapping (assignment)** — назначение вычислений разным процессорам для параллельного выполнения.
- Связующее звено между «computations» и «available processors» — **load balancing**.

## Manager–worker model
- Способ одновременно выполнять вычисления и **динамически** балансировать нагрузку с учётом **нагрузки** и **скорости** каждого процессора: manager раздаёт задания, worker, освободившись, получает следующее. (Будет в практике: MPI manager-worker.)

## Что может пойти не так
### Race condition — пример bank account
- Два потока: один делает 200 000 deposits (+1), другой 200 000 withdrawals (−1) над общим `balance` (начально 1000).
- Без синхронизации: **read-modify-write** (`tmp = balance; tmp ±= 1; balance = tmp`) ⇒ обновления теряются, итог ≠ 1000 — классический **race condition**.
- Исправление: **lock-protected critical section** (`with p.lock: balance[0] += 1`) — защищать минимально только само обновление.

### Определения
- **Race condition** — два и более потока обращаются к общим данным одновременно; результат зависит от непредсказуемого порядка/таймингов. Одновременные чтения безопасны.
- **Data race** — конфликтующие обращения к одной ячейке, **хотя бы одно — запись**, без адекватной синхронизации.
- **Deadlock** — два и более процесса ждут друг друга, чтобы освободить ресурсы ⇒ все застряли навсегда.
- **Livelock** — как deadlock, но **состояния процессов постоянно меняются** относительно друг друга, и никто не продвигается. Livelock — частный случай resource **starvation**.
- **Starvation** — конкретный процесс не продвигается (другие могут).

| Condition | State changes? | Useful progress? |
|---|---|---|
| Deadlock | No | No |
| Livelock | Yes | No |
| Starvation | другие участники прогрессируют | один участник может никогда не продвинуться |

- Аналогии: deadlock — 4 машины въехали на перекрёсток и каждая ждёт другую; livelock — два вежливых человека в коридоре одновременно шагают в одну сторону; starvation — несправедливый scheduler всегда обслуживает других.

### Dining philosophers problem
- 5 философов за круглым столом, между соседями по одной вилке (5 вилок); чтобы есть, нужны обе (левая и правая); после еды кладёт обе.
- Все взяли левую вилку ⇒ **deadlock**.
- Все одновременно отпускают и повторяют ⇒ возможен **livelock**.
- Одного философа постоянно опережают ⇒ **starvation**.
- Решение: пронумеровать вилки и всегда брать **сначала вилку с меньшим номером** ⇒ разрывается **circular wait**.

### Другие проблемы
- **Data corruption** — одновременная модификация общих данных без синхронизации ⇒ некорректное состояние.
- **Synchronization errors** — нарушена координация между параллельными задачами.
- **Fault tolerance issues** — отказ одного компонента может повлиять на всю систему.
- **Performance and load balancing errors** — одни потоки простаивают, другие перегружены.
- **Communication errors** — потеря сообщений, задержки, несовпадение протоколов.
- **Resource contention** — конкуренция за CPU time/memory ⇒ bottlenecks.
- **Floating-point non-reproducibility / round-off variation** — другой порядок операций ⇒ немного другой результат.
- **Dead/unreachable code** — некоторые пути кода не выполняются без правильной координации.
- **Time-dependent errors** — проявляются только при определённых таймингах.
- Борьба: synchronization mechanisms (**mutexes, semaphores, barriers**), правильные design patterns, тщательное тестирование; safe programming languages.

## Taxonomy of causes of problems
| Category | Symptom | Example | Typical response |
|---|---|---|---|
| **Safety/correctness** | неверное состояние/результат | data race, atomicity violation | locks, atomics, reduction, ownership |
| **Liveness** | нет прогресса | deadlock, livelock, starvation | ordering, protocol redesign, fairness |
| **Communication/API** | зависание или неверные данные | collective mismatch, wrong tag/count/type | protocol checks |
| **Numerical** | разные «валидные» результаты | изменённый порядок FP reduction | stable/reproducible reduction |
| **Performance** | корректно, но медленно | imbalance, **false sharing**, contention | profiling, placement, redesign |
| **Resilience** | прерванное/испорченное выполнение | rank crash, node loss, silent bit flip | **checkpointing, replication, recovery** |

- Пример FP: $(10^{16} - 10^{16}) + 1 = 1$, но в double precision $10^{16} + (-10^{16} + 1) = 0$ (1 теряется при округлении) — сложение с плавающей точкой не ассоциативно.

## Fault-tolerant parallel programming (in-class exercise 6)
- Вопросы для разбора: что такое fault tolerance (FT); модель отказа — какое состояние теряется (process/node crash, corrupted checkpoint, silent data corruption, потеря GPU, зависший worker); как обнаруживается отказ; механизм восстановления; overhead (время, хранение, избыточность); главное ограничение.
- Типовые механизмы (из таблицы): **checkpointing** (периодическое сохранение состояния и restart), **replication** (избыточные вычисления), **recovery**.
