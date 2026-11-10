# Карточки — Лекция 07: Decomposition, tasks, and dependency graphs; Decomposition techniques; Mapping techniques for load balancing

<details>
<summary><b>Q:</b> Дайте определения decomposition и task.</summary>

- **Decomposition** — разбиение вычисления на более мелкие части, некоторые или все из которых могут выполняться параллельно.
- **Task** — определённая программистом единица вычисления, полученная decomposition. Tasks могут быть разного размера.

</details>

<details>
<summary><b>Q:</b> Как декомпозировать dense matrix-vector multiplication $y = Ab$ на tasks?</summary>

На $n$ tasks (n — число строк): task $i$ вычисляет $y[i]$ = строка $i$ матрицы $A$ × $b$. Tasks независимы. Coarse-grained вариант — блоки строк (например, 4 tasks).

</details>

<details>
<summary><b>Q:</b> Что такое task dependency graph?</summary>

**DAG**: узлы — tasks, направленные рёбра — зависимости (task ждёт данные другой task). Может быть несвязным.

</details>

<details>
<summary><b>Q:</b> Постройте task dependency graph для запроса MODEL="Civic" AND YEAR="2001" AND (COLOR="Green" OR COLOR="White").</summary>

Листья: Civic, 2001, White, Green (выборки из таблицы). Уровень 2: (Civic AND 2001), (White OR Green). Корень: их пересечение. Альтернатива: (White OR Green) → AND 2001 → AND Civic — более длинная цепочка, меньше параллелизма.

</details>

<details>
<summary><b>Q:</b> Fine-grained vs coarse-grained decomposition?</summary>

Granularity определяется числом и размером tasks. Fine-grained — много маленьких tasks (больше потенциального параллелизма, но больше overhead на scheduling/communication). Coarse-grained — мало больших tasks.

</details>

<details>
<summary><b>Q:</b> Что такое maximum degree of concurrency? Равно ли оно числу листьев DAG?</summary>

Наибольшее число tasks, готовых к выполнению **одновременно** (самый широкий одновременно готовый фронт). Ограничено зависимостями и ресурсами. Число листьев — **не** общая формула.

</details>

<details>
<summary><b>Q:</b> Что такое critical path и span $T_\infty$?</summary>

Critical path — самый длинный **взвешенный** путь от входной task до выходной. Его вес — span $T_\infty$: время выполнения даже на бесконечном числе процессоров.

</details>

<details>
<summary><b>Q:</b> Как вычисляется average degree of concurrency?</summary>

$W / T_\infty$ — суммарная работа (сумма весов всех tasks), делённая на длину critical path. Это свойство алгоритма; реальный speedup зависит ещё от mapping и overhead.

</details>

<details>
<summary><b>Q:</b> Tasks 1–4 весом 10; task 5 (6) зависит от 1,2; task 6 (9) — от 3,4; task 7 (8) — от 5,6. Найдите critical path и average degree of concurrency.</summary>

$W = 40 + 6 + 9 + 8 = 63$. Critical path: $10 + 9 + 8 = 27$. Average concurrency $= 63/27 \approx$ **2.33**. Max concurrency = 4.

</details>

<details>
<summary><b>Q:</b> Tasks 1–4 весом 10; task 5 (6) от 1,2; task 6 (11) от 3 и 5; task 7 (7) от 4 и 6. Critical path и average concurrency?</summary>

$W = 40 + 6 + 11 + 7 = 64$. Critical path: $10 + 6 + 11 + 7 = 34$. Average $= 64/34 \approx$ **1.88**.

</details>

<details>
<summary><b>Q:</b> Что такое task-interaction graph и чем он отличается от task dependency graph?</summary>

Узлы — tasks, рёбра соединяют **взаимодействующие** (обменивающиеся данными) tasks. Dependency graph — ориентированный ациклический граф порядка выполнения; interaction graph описывает коммуникацию (обычно неориентированный, может иметь циклы). Interaction ограничивает speedup наряду с granularity и concurrency.

</details>

<details>
<summary><b>Q:</b> Как выглядит task-interaction graph для sparse matrix-vector multiplication?</summary>

Task $i$ владеет строкой $A[i,*]$ и $x[i]$, вычисляет $y[i]$. Ребро $i$–$j$, если $A[i,j] \ne 0$: task $i$ нужен $x[j]$ от task $j$.

</details>

<details>
<summary><b>Q:</b> Что такое mapping и как он соотносится с decomposition?</summary>

Mapping — назначение tasks процессам. Decomposition определяет **degree of concurrency**, а mapping — **сколько её реально используется** и насколько эффективно.

</details>

<details>
<summary><b>Q:</b> Process vs processor?</summary>

Process — логический вычислительный агент, выполняющий tasks (использует код и данные task, может коммуницировать). Processor — аппаратный блок, физически выполняющий вычисления.

</details>

<details>
<summary><b>Q:</b> Назовите основные decomposition techniques.</summary>

Recursive, data, exploratory, speculative (+ hybrid — комбинация).

</details>

<details>
<summary><b>Q:</b> Что такое recursive decomposition? Примеры.</summary>

Для divide-and-conquer задач: делим на независимые подзадачи, рекурсивно делим их, затем объединяем. Примеры: quicksort, поиск минимума деревом попарных min, рекурсивное блочное умножение матриц (8 произведений параллельно, затем 4 суммы).

</details>

<details>
<summary><b>Q:</b> Постройте recursive decomposition для минимума {4, 9, 1, 7, 8, 11, 2, 12}.</summary>

Уровень 1: min(4,9)=4, min(1,7)=1, min(8,11)=8, min(2,12)=2. Уровень 2: min(4,1)=1, min(8,2)=2. Корень: min(1,2)=1. 7 tasks, глубина 3.

</details>

<details>
<summary><b>Q:</b> Опишите data decomposition и варианты разбиения данных.</summary>

Два шага: (1) разбить данные; (2) разбиение данных индуцирует разбиение вычислений на tasks. Варианты: partitioning output, input, both input and output, intermediate data.

</details>

<details>
<summary><b>Q:</b> Output data partitioning для matrix multiplication 2×2 блоками: какие tasks?</summary>

4 tasks:
$C_{1,1} = A_{1,1}B_{1,1} + A_{1,2}B_{2,1}$; $C_{1,2} = A_{1,1}B_{1,2} + A_{1,2}B_{2,2}$; $C_{2,1} = A_{2,1}B_{1,1} + A_{2,2}B_{2,1}$; $C_{2,2} = A_{2,1}B_{1,2} + A_{2,2}B_{2,2}$.

</details>

<details>
<summary><b>Q:</b> Тождественна ли data decomposition decomposition вычисления на tasks?</summary>

Нет. При одной и той же data decomposition (2×2 блоки) можно получить разные разбиения на 8 tasks (Decomposition I и II отличаются порядком слагаемых и, значит, использованием данных).

</details>

<details>
<summary><b>Q:</b> Item-set frequencies: чем отличаются input и output partitioning?</summary>

- Output: каждая task считает частоты своего подмножества itemsets по **всей** базе транзакций — результаты независимы.
- Input: каждая task обрабатывает **свою часть транзакций** для всех itemsets; частичные счётчики потом нужно **сложить** (дополнительный шаг reduction).
- Both: комбинация (например, 4 tasks = 2 части транзакций × 2 части itemsets).

</details>

<details>
<summary><b>Q:</b> Зачем partitioning intermediate data? Пример.</summary>

Может дать **больше concurrency**, чем input/output partitioning. Matmul: 3D промежуточная $D_{k,i,j} = A_{i,k}B_{k,j}$ — Stage I: 8 независимых tasks; Stage II: 4 tasks $C_{i,j} = D_{1,i,j} + D_{2,i,j}$. Итого 12 tasks, max concurrency 8 вместо 4.

</details>

<details>
<summary><b>Q:</b> Что такое exploratory decomposition и чем она отличается от data decomposition?</summary>

Разбиение **пространства поиска** на части и параллельный поиск (пример: 15-puzzle). В отличие от data decomposition, незавершённые tasks **прерываются**, как только найдено решение; работа параллельной версии может быть **меньше или больше**, чем serial.

</details>

<details>
<summary><b>Q:</b> Что такое speculative decomposition? Примеры.</summary>

Параллельно вычисляются несколько возможных ветвей **до того, как известно условие**; затем один результат сохраняется, остальное отбрасывается. Обмен лишней работы/энергии на меньшую latency. Примеры: branch prediction, speculative execution, hedged requests.

</details>

<details>
<summary><b>Q:</b> Приведите пример hybrid decomposition.</summary>

Minimum массива из 16 элементов на 4 tasks: data decomposition на 4 блока (локальные min), затем recursive decomposition — дерево min над 4 результатами.

</details>

<details>
<summary><b>Q:</b> Назовите характеристики tasks, влияющие на mapping.</summary>

1. Task generation (static / dynamic)
2. Task sizes (uniform / non-uniform)
3. Knowledge of task sizes (известны заранее или нет)
4. Size of data associated with tasks

</details>

<details>
<summary><b>Q:</b> Static vs dynamic task generation, примеры.</summary>

- Static: все tasks известны до старта (matrix multiplication; минимум списка рекурсивно).
- Dynamic: известны лишь правила порождения (quicksort — подзадачи зависят от pivot). Exploratory (15-puzzle) может быть и тем, и другим.

</details>

<details>
<summary><b>Q:</b> Приведите примеры uniform/non-uniform tasks и известных/неизвестных размеров.</summary>

Uniform и известные заранее — tasks в matmul decompositions. Non-uniform — quicksort. Неизвестные — 15-puzzle (неизвестно, сколько ходов до решения).

</details>

<details>
<summary><b>Q:</b> Назовите четыре измерения характеристик task interactions.</summary>

Static vs dynamic; regular vs irregular; read-only vs read-write; one-way vs two-way.

</details>

<details>
<summary><b>Q:</b> Какие две конкурирующие стоимости минимизирует хороший mapping?</summary>

1. Время communication и synchronization.
2. Idle time из-за load imbalance.
Компромисс: держать взаимодействующие tasks рядом, не перегружая отдельные процессы.

</details>

<details>
<summary><b>Q:</b> 12 единичных tasks, 4 процесса, синхронизация после tasks 1–8. Сравните mapping {1,5,9},{2,6,10},{3,7,11},{4,8,12} и {1,2,3},{4,5,6},{7,8,9},{10,11,12}.</summary>

Первый: до sync каждый делает 2 tasks (t=2), после — по 1 ⇒ finish **t=3**. Второй: P1, P2 делают по 3 tasks до sync, P4 простаивает ⇒ sync при t=3, затем P4 делает 10,11,12 ⇒ finish **t=6**. Балансировать нужно в каждой фазе между синхронизациями.

</details>

<details>
<summary><b>Q:</b> Static vs dynamic mapping: определения и когда что выбирать.</summary>

- Static — до выполнения; проще; подходит, когда размеры tasks известны или данных у tasks много (перемещать дорого).
- Dynamic — во время выполнения; обязателен при dynamic task generation; лучше при неизвестных размерах tasks; сложнее, особенно в message passing.

</details>

<details>
<summary><b>Q:</b> Перечислите schemes for static mapping.</summary>

- Based on data partitioning: array distributions (block, cyclic/block-cyclic, randomized block) и graph partitioning.
- Based on task partitioning: hierarchical mappings.

</details>

<details>
<summary><b>Q:</b> Когда подходит block distribution?</summary>

Когда есть **locality of interaction** — вычисление элемента требует соседних элементов. Каждый процесс получает непрерывный однородный блок (1D row/column-wise или 2D grid).

</details>

<details>
<summary><b>Q:</b> Почему для matmul 2D block partitioning C лучше 1D?</summary>

При 1D (полосы строк C) процессу нужны полоса $A$ и **вся** $B$. При 2D (блок C) — только полоса строк $A$ и полоса столбцов $B$ ⇒ меньше разделяемых данных/коммуникации.

</details>

<details>
<summary><b>Q:</b> Зачем block-cyclic distribution?</summary>

Для устранения load imbalance и idling, когда работа неравномерна по массиву: блоков больше, чем процессов, раздаются по кругу (P0,P1,P2,P3,P0,…), так что каждый процесс получает куски из всех частей массива.

</details>

<details>
<summary><b>Q:</b> Когда нужна randomized block distribution? Приведите пример 1D.</summary>

Когда даже block-cyclic даёт дисбаланс (например, ненулевые блоки сосредоточены у диагонали). Блоки назначаются по случайной перестановке: 12 блоков, random = [8,2,6,0,3,7,11,1,9,5,4,10] ⇒ P0{8,2,6}, P1{0,3,7}, P2{11,1,9}, P3{5,4,10}.

</details>

<details>
<summary><b>Q:</b> Что такое graph partitioning mapping и почему он лучше случайного распределения mesh?</summary>

Для нерегулярных sparse mesh (например, Lake Superior): граф разбивается на части с **равным числом элементов** и **минимумом рёбер между частями**. Случайное распределение заставляет каждый процесс получать много данных других процессов — огромная коммуникация.

</details>

<details>
<summary><b>Q:</b> Что такое hierarchical mapping? Пример.</summary>

Одна decomposition отображается на несколько уровней hardware: MPI между узлами, OpenMP/tasks внутри узла, OpenCL/CUDA/HIP на GPU (hybrid CPU–GPU application).

</details>
