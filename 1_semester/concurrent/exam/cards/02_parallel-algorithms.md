# Карточки — Лекция 02: Parallel Algorithms

<details>
<summary><b>Q:</b> Problem vs algorithm vs implementation — в чём разница (на примере простых чисел)?</summary>

- Problem: найти все простые от 2 до n.
- Algorithm: Sieve of Eratosthenes (или другие).
- Implementation: serial / parallel — отличаются структурами данных и управляющими конструкциями.

</details>

<details>
<summary><b>Q:</b> Почему нельзя наивно распараллелить решето, вычёркивая кратные каждого числа в отдельном потоке?</summary>

Следующее число, кратные которого нужно вычёркивать, известно только **после** вычёркивания кратных предыдущего — зависимость между шагами.

</details>

<details>
<summary><b>Q:</b> Какую стратегию распараллеливания решета предлагают для shared memory?</summary>

Один массив. Thread 0 обрабатывает 2..sqrt(n) и **broadcast**'ит каждое найденное простое остальным; потоки > 0 вычёркивают кратные в своём блоке. Для части 2..sqrt(n) ускорения нет (как в Amdahl's law).

</details>

<details>
<summary><b>Q:</b> Как решето делается в distributed memory? Почему дублирование не страшно?</summary>

Каждый процесс сам вычисляет простые 2..sqrt(n) (массив A) и вычёркивает кратные в своём сегменте B = (L, H]; затем шлёт B процессу 0, который объединяет. Дублирование идёт параллельно и **экономит коммуникацию**.

</details>

<details>
<summary><b>Q:</b> Как можно делить числа sqrt(n)+1..n между процессами?</summary>

Равные chunks (если процессоры одинаково мощные); блоками или **interleaving**; нужно обработать случай, когда деление не ровное.

</details>

<details>
<summary><b>Q:</b> Назовите 4 шага Foster's methodology.</summary>

**Partitioning, Communication, Agglomeration, Mapping** (PCAM). Полезные шаги, но не механический рецепт.

</details>

<details>
<summary><b>Q:</b> Domain decomposition vs functional decomposition?</summary>

- **Domain**: делим **данные** на много мелких одинаковых кусков (самый большой/частый объект данных), каждому — primitive task. ⇒ data parallelism (пример: обработка 3D-объекта по пикселю).
- **Functional**: делим **функции** на отдельные задачи, применяемые к данным. ⇒ functional parallelism (пример: три разные операции над аудиосигналом на разном железе).

</details>

<details>
<summary><b>Q:</b> Критерии хорошего partitioning?</summary>

- Задач хотя бы **на порядок больше**, чем процессоров.
- Нет избыточных вычислений/хранения.
- Primitive tasks примерно одного размера.
- Число задач растёт с размером задачи (а не размер задач).
- Рассмотрено несколько альтернатив (domain и functional).

</details>

<details>
<summary><b>Q:</b> Какие вопросы задаются на шаге Communication и каковы критерии?</summary>

Какая коммуникация нужна; local или global; есть ли паттерн (сетка/соседи). Критерии: сбалансированное число коммуникаций у задач; общение с малым числом соседей; коммуникации и вычисления могут идти concurrently.

</details>

<details>
<summary><b>Q:</b> Что делается на шаге Agglomeration и зачем?</summary>

Объединяем 2+ задачи в более крупные ⇒ меньше задач, меньше коммуникации (больше **locality**), проще код, лучше производительность. Это **tradeoff**: должно оставаться достаточно concurrency и масштабируемость с размером задачи.

</details>

<details>
<summary><b>Q:</b> Что такое Mapping и его цель?</summary>

Назначение задач процессорам (может делаться автоматически). Цель — минимизировать время, т.е. максимизировать загрузку процессоров; часто общающиеся задачи — с дешёвой коммуникацией; load balancing.

</details>

<details>
<summary><b>Q:</b> Критерии mapping?</summary>

- Рассмотрены one task per processor и multiple tasks per processor.
- Рассмотрены static и dynamic распределение.
- Centralized load balancing — менеджер не bottleneck.
- Dynamic — оценены издержки стратегий.

</details>

<details>
<summary><b>Q:</b> В каком шаге Foster код начинает учитывать конкретную машину?</summary>

Partitioning и communication — машинно-независимы; в agglomeration задачи укрупняются под производительность реальной системы, mapping назначает их процессорам.

</details>

<details>
<summary><b>Q:</b> Что такое embarrassingly parallel? Примеры.</summary>

Задачи, которые легко распараллелить (независимые части). Независимые поиски (биоинформатика, BLAST), фракталы (Mandelbrot — каждый пиксель независимо).

</details>

<details>
<summary><b>Q:</b> Какие проблемы concurrent программ упоминаются как то, чего надо избегать?</summary>

Starvation, race conditions, deadlocks.

</details>

<details>
<summary><b>Q:</b> Все ли задачи можно эффективно распараллелить? Что такое NC?</summary>

Вероятно, все алгоритмы распараллеливаемы, но **не все хорошо**. NC — задачи, решаемые за полилогарифмическое время на параллельном компьютере с полиномиальным числом процессоров. **P = NC?** — открытый вопрос.

</details>

<details>
<summary><b>Q:</b> Что такое CCS и CSP?</summary>

Process calculi для моделирования параллельных/распределённых систем: компоненты, их наблюдаемое поведение и взаимодействие.
- **CCS** — Calculus of Communicating Systems (Robin Milner).
- **CSP** — Communicating Sequential Processes (Hoare); вдохновил Go; реализации pyCSP, js-csp, CSP for Java.

</details>

<details>
<summary><b>Q:</b> CCS: A := a.b.A; B := a.B; C := b.C. Реализует ли (B | C) спецификацию A?</summary>

Нет: (B | C) выполняет a и b **в неопределённом порядке**, а A требует строго a, b, a, b...

</details>

<details>
<summary><b>Q:</b> Как в CCS заставить B и C чередовать a и b (без shared memory)?</summary>

Синхронизация через каналы: `B' := c.d.b.B'`, `C' := c.a.d.C'`, `A' := (B' | C')\{c,d}`. Синхронизируются на c → a → на d → b → заново. `\{c,d}` скрывает (restriction) каналы. Формально можно доказать A == A'.

</details>

<details>
<summary><b>Q:</b> Что означают query!i и query?i в CSP?</summary>

Отправка (`!`) и приём (`?`) значения i по именованному каналу query — процессы A = query!i и B = query?i обмениваются i.

</details>

<details>
<summary><b>Q:</b> Какие 4 базовых действия задачи в модели Foster (диаграммы)?</summary>

Помимо чтения/записи локальной памяти: send message, receive message, create new tasks (suspend до их завершения), terminate. Диаграммы ad hoc — стандарта нет.

</details>
