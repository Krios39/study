# Карточки — Лекция 06: Parallel Algorithm Design Principles; Fault-tolerance in parallel computing

<details>
<summary><b>Q:</b> Чем parallel algorithm отличается от sequential algorithm?</summary>

Sequential — рецепт (последовательность шагов) для serial computer. Parallel — рецепт решения на нескольких процессорах; кроме шагов он задаёт **dimension of concurrency** — какие наборы шагов можно выполнять одновременно.

</details>

<details>
<summary><b>Q:</b> Что включает проектирование параллельного алгоритма? (5 пунктов)</summary>

1. Identifying работы, выполнимой concurrently
2. Mapping concurrent частей на процессы
3. Distributing input/output/intermediate data
4. Managing accesses к разделяемым данным
5. Synchronizing процессоров на разных стадиях

</details>

<details>
<summary><b>Q:</b> Назовите два ключевых шага проектирования параллельного алгоритма и что их связывает.</summary>

1. **Decomposition** — разбиение вычисления на более мелкие части.
2. **Mapping/assignment** — назначение частей процессорам.
Между ними — **load balancing**.

</details>

<details>
<summary><b>Q:</b> Что такое manager–worker model и зачем она?</summary>

Manager раздаёт задания, освободившийся worker получает следующее. Так вычисления и **dynamic load balancing** выполняются одновременно с учётом нагрузки и скорости каждого процессора.

</details>

<details>
<summary><b>Q:</b> Почему в примере с банковским счётом (deposits и withdrawals в двух потоках) баланс оказывается неверным? Как исправить?</summary>

Неатомарный **read-modify-write** (`tmp=balance; tmp±=1; balance=tmp`): потоки читают старое значение и перезаписывают обновления друг друга — race condition. Исправление: lock-protected critical section вокруг обновления (`with lock: balance += 1`) или atomic-операции.

</details>

<details>
<summary><b>Q:</b> Race condition vs data race?</summary>

- **Race condition**: результат зависит от непредсказуемого порядка/таймингов потоков, обращающихся к общим данным.
- **Data race**: конфликтующие обращения к одной ячейке, хотя бы одно — **запись**, без адекватной синхронизации. Одновременные чтения безопасны.

</details>

<details>
<summary><b>Q:</b> Определите deadlock, livelock, starvation.</summary>

- **Deadlock** — процессы ждут друг друга бесконечно, состояние не меняется.
- **Livelock** — состояния постоянно меняются, но прогресса нет (частный случай starvation).
- **Starvation** — конкретный процесс не продвигается, хотя другие прогрессируют.

</details>

<details>
<summary><b>Q:</b> Заполните таблицу: меняется ли состояние и есть ли полезный прогресс при deadlock / livelock / starvation?</summary>

| | State changes? | Progress? |
|---|---|---|
| Deadlock | No | No |
| Livelock | Yes | No |
| Starvation | другие прогрессируют | один может никогда |

</details>

<details>
<summary><b>Q:</b> Приведите бытовые аналогии deadlock, livelock и starvation.</summary>

- Deadlock: 4 машины на перекрёстке, каждая ждёт другую.
- Livelock: два вежливых человека в коридоре одновременно шагают в одну сторону.
- Starvation: несправедливый scheduler всегда обслуживает других.

</details>

<details>
<summary><b>Q:</b> Dining philosophers: как возникают deadlock, livelock, starvation и как избежать deadlock?</summary>

- Все берут левую вилку → deadlock.
- Все одновременно отпускают и повторяют → livelock.
- Одного постоянно опережают → starvation.
Решение: пронумеровать вилки и всегда брать сначала **меньший номер** → разрывается circular wait.

</details>

<details>
<summary><b>Q:</b> Почему параллельная сумма чисел с плавающей точкой может отличаться от последовательной? Пример.</summary>

Сложение FP не ассоциативно, параллельная reduction меняет порядок. $(10^{16} - 10^{16}) + 1 = 1$, но $10^{16} + (-10^{16} + 1) = 0$ в double precision. Ответ: stable/reproducible reduction.

</details>

<details>
<summary><b>Q:</b> Перечислите категории taxonomy of causes of problems с примерами.</summary>

- Safety/correctness — data race, atomicity violation
- Liveness — deadlock, livelock, starvation
- Communication/API — collective mismatch, wrong tag/count/type
- Numerical — изменённый порядок FP reduction
- Performance — imbalance, false sharing, contention
- Resilience — rank crash, node loss, silent bit flip

</details>

<details>
<summary><b>Q:</b> Какие типичные ответы (responses) на каждую категорию проблем?</summary>

Safety → locks, atomics, reduction, ownership. Liveness → ordering, protocol redesign, fairness. Communication → protocol checks. Numerical → stable/reproducible reduction. Performance → profiling, placement, redesign. Resilience → checkpointing, replication, recovery.

</details>

<details>
<summary><b>Q:</b> Какие ещё проблемы параллельных вычислений перечислены на слайдах (кроме race/deadlock)?</summary>

Data corruption, synchronization errors, fault tolerance issues, performance/load balancing errors, communication errors (потеря/задержка сообщений, несовпадение протоколов), resource contention, FP non-reproducibility, dead/unreachable code, time-dependent errors.

</details>

<details>
<summary><b>Q:</b> Какими средствами борются с ошибками параллельных программ?</summary>

Synchronization mechanisms (mutexes, semaphores, barriers), правильные design patterns, тщательное тестирование, safe programming languages.

</details>

<details>
<summary><b>Q:</b> Что такое fault tolerance в параллельном программировании и какие основные механизмы?</summary>

Способность продолжить/корректно завершить вычисление при отказе компонентов (crash процесса/узла, silent data corruption, потеря GPU, зависший worker). Механизмы: **checkpointing** (сохранение состояния + restart), **replication** (избыточность), recovery. Ценой overhead по времени, памяти/хранению или ресурсам.

</details>

<details>
<summary><b>Q:</b> Какие вопросы нужно разобрать при анализе fault-tolerance подхода (по in-class exercise 6)?</summary>

1. Failure model и какое состояние теряется
2. Как отказ обнаруживается
3. Механизм восстановления
4. Overhead (runtime, storage, redundancy)
5. Главное ограничение

</details>

<details>
<summary><b>Q:</b> Что такое false sharing и к какой категории проблем он относится?</summary>

Разные потоки пишут в разные переменные, лежащие в одной cache line, из-за чего cache coherence постоянно гоняет эту строку между ядрами. Результат корректен, но медленный — категория **Performance**.

</details>
