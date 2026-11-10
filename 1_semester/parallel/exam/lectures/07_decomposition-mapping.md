# Лекция 07: Decomposition, tasks, and dependency graphs; Decomposition techniques; Mapping techniques for load balancing

Слайды: lecture-slides.pdf, стр. 102–158 (стр. 159 — in-class exercise 8 к гостевой лекции GPGPU, не входит)

## Decomposition и tasks
- **Decomposition** — процесс разбиения вычисления на более мелкие части, некоторые или все из которых могут выполняться параллельно.
- **Tasks** — определённые программистом единицы вычисления, на которые основное вычисление разбивается через decomposition. Tasks могут быть **разного размера**.
- Пример: dense **matrix-vector multiplication** $y = Ab$ разбивается на $n$ tasks — task $i$ вычисляет $y[i]$ (строка $A$ × вектор $b$).

## Task dependency graph
- Некоторые tasks используют данные, созданные другими, и должны ждать их завершения.
- **Task dependency graph** — **DAG (Directed Acyclic Graph)**: узлы — tasks, направленные рёбра — зависимости. Граф **может быть несвязным** (например, для matrix-vector — вообще без рёбер).
- **Пример — database query**: `MODEL="Civic" AND YEAR="2001" AND (COLOR="Green" OR COLOR="White")`.
  - Вариант 1: листья Civic, 2001, White, Green → (Civic AND 2001) и (White OR Green) → итог. Результат: ID 6734 (Civic, 2001, White).
  - Вариант 2 (alternate): White OR Green → 2001 AND (White OR Green) → Civic AND … — другой граф, более последовательный. Одна задача допускает разные decompositions с разной степенью параллелизма.

## Granularity, concurrency
- **Granularity** декомпозиции определяется числом и размером tasks.
  - **Fine-grained** — много маленьких tasks (matrix-vector: по одной строке на task).
  - **Coarse-grained** — мало больших tasks (matrix-vector: 4 tasks по блоку строк).
- **Maximum degree of concurrency** — наибольшее число tasks, которые могут быть готовы **одновременно**. Ограничено зависимостями и ресурсами, а не просто общим числом tasks. Для общего DAG — самый широкий одновременно готовый «фронт»; число листьев — **не** общая формула.
- Более мелкие tasks могут открыть больше параллелизма, но увеличивают scheduling и communication overhead.

## Critical path и average degree of concurrency
- **Critical path** — самый длинный **взвешенный** путь от входной task до выходной. Его вес — **span $T_\infty$**: время выполнения даже на бесконечном числе процессоров.
- **Average degree of concurrency (average available parallelism)** $= W / T_\infty$, где $W$ — суммарная работа (сумма весов всех tasks).
- Это свойство алгоритма; реальный speedup зависит также от mapping и overhead.
- **Пример со слайдов** (веса в узлах):
  - Граф 1: tasks 1–4 по 10; task 5 = 6 (из 1,2), task 6 = 9 (из 3,4), task 7 = 8 (из 5,6). $W = 63$, critical path $10+9+8 = 27$ ⇒ **2.33**.
  - Граф 2: tasks 1–4 по 10; task 5 = 6 (из 1,2), task 6 = 11 (из 3 и 5), task 7 = 7 (из 4 и 6). $W = 64$, critical path $10+6+11+7 = 34$ ⇒ **1.88**.
  - Вывод: одинаковое число tasks может давать очень разный параллелизм.

## Task-interaction graph
- Кроме granularity и degree of concurrency, speedup ограничивает **interaction** между tasks на разных процессорах.
- **Task-interaction graph**: узлы — tasks, рёбра соединяют взаимодействующие tasks (обмен данными); в отличие от dependency graph может быть неориентированным и содержать циклы.
- Пример: **sparse matrix-vector multiplication** — task $i$ владеет строкой $A[i,*]$ и элементом $x[i]$ (и вычисляет $y[i]$); ребро $i$–$j$, если $A[i,j] \ne 0$ (task $i$ нужен $x[j]$).

## Processes and mapping
- **Process** — абстрактная сущность, использующая код и данные task, чтобы произвести её результат за конечное время после активации; может также синхронизироваться и обмениваться данными с другими процессами.
- **Mapping** — механизм назначения tasks процессам. Важен для эффективности.
- **Degree of concurrency определяется decomposition, а mapping определяет, сколько этой concurrency реально используется и насколько эффективно.**
- Пример mapping (графы выше на 4 процесса P0–P3): листья по одному на процесс; промежуточные tasks ставятся на процесс, который выполнял одного из «родителей» (минимизация коммуникации).
- **Processes vs processors**: processes — логические агенты, выполняющие tasks; processors — аппаратные блоки, физически выполняющие вычисления. Разделение полезно для гибридного hardware с несколькими programming paradigms.

## Decomposition techniques
Не гарантируют лучший алгоритм, но дают хорошую отправную точку; можно комбинировать.
1. **Recursive decomposition**
2. **Data decomposition**
3. **Exploratory decomposition**
4. **Speculative decomposition**
(+ **Hybrid**.)

### 1. Recursive decomposition
- Для задач, решаемых **divide-and-conquer**: делим на независимые подзадачи, рекурсивно делим их, затем объединяем результаты.
- **Quicksort**: Divide — выбрать pivot, разбить на < pivot и ≥ pivot; Conquer — рекурсивно отсортировать подмассивы; Combine — конкатенация. Task-dependency graph — дерево (пример для 12 чисел).
- **Minimum** последовательности {4, 9, 1, 7, 8, 11, 2, 12}: дерево попарных min: min(4,9), min(1,7), min(8,11), min(2,12) → min(4,1), min(8,2) → min(1,2) = 1.
- **Matrix multiplication** рекурсивно: $C = AB$ разбивается на 2×2 блоки; 8 рекурсивных произведений P0…P7 вычисляются параллельно, затем 4 суммы $C_{pp} = P0+P1$, … тоже параллельно.

### 2. Data decomposition
- Мощный и распространённый метод для алгоритмов над **большими структурами данных**. Два шага: (1) разбиение данных; (2) разбиение данных индуцирует разбиение вычислений на tasks.
- Варианты: partitioning **output** data, **input** data, **both input and output**, **intermediate** data.
- **Output partitioning — matrix multiplication**: $A$, $B$, $C$ на 2×2 блоки ⇒ 4 tasks: $C_{1,1} = A_{1,1}B_{1,1} + A_{1,2}B_{2,1}$ и т.д.
- **Data decomposition ≠ decomposition вычисления на tasks**: при одной и той же data decomposition можно получить разные разбиения на 8 tasks (Decomposition I и II — разный порядок слагаемых).
- **Item-set frequencies в transaction database**:
  - output partitioning — каждая task считает частоты своей части itemsets по всей базе;
  - input partitioning — каждая task обрабатывает свою часть транзакций по всем itemsets; затем частичные счётчики надо **суммировать**;
  - both input and output — 4 tasks (часть транзакций × часть itemsets).
- **Intermediate data partitioning** может дать **больше concurrency**, чем input/output. Пример: matmul с 3D промежуточной матрицей $D_{k,i,j} = A_{i,k}B_{k,j}$:
  - Stage I: 8 tasks вычисляют $D_{k,i,j}$; Stage II: 4 tasks $C_{i,j} = D_{1,i,j} + D_{2,i,j}$.
  - Task-dependency graph: 12 tasks; пары (1,2)→9, (3,4)→10, (5,6)→11, (7,8)→12.

### 3. Exploratory decomposition
- Разбиваем **пространство поиска** на части и ищем в них параллельно, пока не найдено решение. Пример: **15-puzzle** (дерево состояний, ветви — разные ходы; каждая ветка — task).
- Отличие от data decomposition:
  - в data decomposition tasks выполняются **полностью**, и каждая делает полезную для решения работу;
  - в exploratory **незавершённые tasks прерываются**, как только найдено решение;
  - работа параллельной версии может быть **меньше или больше**, чем у serial (⇒ возможен superlinear или sublinear speedup).

### 4. Speculative decomposition
- Вычисляет **несколько возможных ветвей до того, как известно условие**, выбирающее ветвь. Когда условие разрешено — один результат сохраняется, остальная работа отбрасывается.
- Обменивает **лишнюю работу и энергию на меньшую latency**. Примеры: branch prediction, speculative execution, hedged requests (при наличии свободных ресурсов).

### Hybrid decomposition
- Комбинация техник. Пример: minimum массива из 16 элементов на 4 tasks — сначала **data decomposition** (4 блока по 4, локальные min: 2, 4, 6, 1), затем **recursive decomposition** (дерево: min(2,4)=2, min(6,1)=1 → 1).

## Characteristics of tasks
Влияют на выбор хорошего mapping:
1. **Task generation**
   - **Static**: все tasks известны до начала выполнения. Data decomposition обычно → static (matrix multiplication); recursive тоже может (minimum списка).
   - **Dynamic**: конкретные tasks и граф заранее не известны, известны лишь правила их порождения. Recursive может → dynamic (quicksort). Exploratory — static или dynamic (15-puzzle).
   - Иллюстрация: средний возраст жителей города (Venice — фиксированные дома vs floating village — меняющаяся структура).
2. **Task sizes** — относительное время выполнения task. **Uniform** (matmul decompositions) vs **non-uniform** (quicksort). От этого зависит сложность mapping.
3. **Knowledge of task sizes** — если размеры известны, их можно использовать при mapping (matmul — известно заранее; 15-puzzle — неизвестно, сколько ходов до решения).
4. **Size of data associated with tasks** — данные task должны быть доступны процессу; размер и расположение данных могут определять, какой процесс выполнит task без чрезмерных затрат на перемещение данных.

## Characteristics of task interactions
- **Static vs dynamic** (шаблон взаимодействия известен заранее или нет)
- **Regular vs irregular** (есть ли структура, которую можно использовать)
- **Read-only vs read-write** (только читают общие данные или и пишут)
- **One-way vs two-way** (инициирует только одна сторона или обе участвуют)

## Mapping techniques for load balancing
- Хороший mapping минимизирует две **конкурирующие** стоимости:
  - время communication и synchronization;
  - idle time из-за load imbalance.
- Другие ограничения: heterogeneous processor speeds, меняющаяся нагрузка системы, memory capacity, network topology, congestion.
- Лучший mapping — компромисс: **держать взаимодействующие tasks рядом, не перегружая отдельные процессы**.
- **Пример (12 tasks, 4 процесса, синхронизация после tasks 1–8)**:
  - Mapping 1: P1:{1,5,9}, P2:{2,6,10}, P3:{3,7,11}, P4:{4,8,12} ⇒ sync при t=2, finish **t=3**.
  - Mapping 2: P1:{1,2,3}, P2:{4,5,6}, P3:{7,8,9}, P4:{10,11,12} ⇒ P4 ждёт до sync (t=3), finish **t=6**. Балансировка нужна **в каждой фазе** между синхронизациями, а не только суммарно.

### Static vs dynamic mapping
- **Static**: tasks распределяются **до начала** выполнения. Для статически порождённых tasks можно и static, и dynamic. Алгоритмы со static mapping проще проектировать и программировать.
- **Dynamic**: работа распределяется **во время** выполнения. Если tasks порождаются динамически — mapping тоже обязан быть dynamic. Сложнее, особенно в message-passing.
- Если **размеры tasks неизвестны** — static может дать серьёзный load imbalance ⇒ dynamic обычно эффективнее.
- Если **данных у tasks много** относительно вычислений — dynamic mapping потребует перемещать данные, это может перевесить выгоды ⇒ static лучше.

## Schemes for static mapping
- **Mappings based on data partitioning**:
  - Array distribution schemes: **block**, **cyclic и block-cyclic**, **randomized block**.
  - **Graph partitioning**.
- **Mappings based on task partitioning**: **hierarchical mappings**.

### Block distributions
- Простейший способ: каждому процессу — однородный **непрерывный** кусок массива.
- Подходит при **locality of interaction** (вычисление элемента требует соседних элементов).
- 1D: row-wise или column-wise на 8 процессов. 2D: 4×4 или 2×8 process grid.
- **Matmul**: при 1D partitioning C (по строкам) процессу нужна полоса строк $A$ и **вся** $B$; при 2D partitioning (блок C) — полоса строк $A$ и полоса столбцов $B$ ⇒ 2D требует меньше разделяемых данных.

### Block-cyclic distributions
- Вариация block distribution для **устранения load imbalance и idling**: массив делится на блоков больше, чем процессов, блоки раздаются по кругу (1D: P0,P1,P2,P3,P0,…; 2D: 2×2 решётка процессов повторяется). Cyclic — частный случай с блоком из 1 элемента.
- Полезно, когда объём работы неравномерен по массиву (например, LU/Gauss — активная часть матрицы сужается).

### Randomized block distributions
- Если структура данных такова, что block-cyclic всё равно даёт дисбаланс (например, разреженная/ленточная матрица, где ненулевые блоки концентрируются у диагонали), блоки назначают **случайной перестановкой**.
- Пример 1D: 12 блоков $V = [0..11]$, random(V) = [8, 2, 6, 0, 3, 7, 11, 1, 9, 5, 4, 10] ⇒ P0: {8,2,6}, P1: {0,3,7}, P2: {11,1,9}, P3: {5,4,10}.
- 2D: случайная перестановка строк и столбцов блоков, затем блочное распределение на 4×4 решётку процессов.

### Graph partitioning
- Для **sparse** структур с data-dependent, сильно **нерегулярным** взаимодействием — типично численные симуляции физики: область дискретизирована **mesh** элементов; вычисление в узле требует данных соседей.
- Пример: mesh озера Lake Superior.
  - **Случайное** распределение элементов по 8 процессам ⇒ каждому процессу нужно много точек других процессов (огромная коммуникация).
  - **Graph-partitioning algorithm** ⇒ части с **равным числом элементов** (балансировка) и **минимальным числом рёбер между частями** (минимум коммуникации).

### Hierarchical mappings (task partitioning)
- Одна decomposition отображается на **несколько уровней hardware**: **MPI между узлами**, **OpenMP/tasks внутри узла**, **OpenCL/CUDA/HIP на GPU**. Пример: hybrid CPU–GPU application.

## Schedulers (in-class exercise 7)
- Как делят HPC-систему между пользователями: **job schedulers / resource managers** для кластеров (например, Slurm, PBS) — очереди задач, выделение узлов, приоритеты.
