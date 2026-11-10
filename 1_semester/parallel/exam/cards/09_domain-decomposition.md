# Карточки — Лекция 09: Domain Decomposition Method

<details>
<summary><b>Q:</b> Что такое domain decomposition?</summary>

Data decomposition больших научных/инженерных задач: физическая область (mesh) делится на подобласти, каждая обрабатывается своим процессором. Используется как метод (preconditioner) для решения линейных систем со sparse matrices.

</details>

<details>
<summary><b>Q:</b> Назовите этапы serial direct solver для sparse систем и их относительную стоимость.</summary>

Анализ/ordering неизвестных (~100 time units) → sparse LU-factorisation (~10) → решение треугольных систем (~1).

</details>

<details>
<summary><b>Q:</b> Какие serial и parallel solvers упоминаются для sparse систем?</summary>

- Serial iterative: Gauss-Seidel, CG, GMRES.
- Parallel direct: MUMPS.
- Parallel iterative: Krylov subspace methods — PCG, PGMRES, FGMRES; для больших задач нужны хорошие preconditioners → domain decomposition preconditioners.

</details>

<details>
<summary><b>Q:</b> Почему для больших sparse систем предпочитают iterative методы и в чём их проблема?</summary>

Из-за memory restrictions и sparsity (direct методы дают fill-in). Проблема: скорость сходимости зависит от спектра (eigenvalues) матрицы; при $N = 10^6$ может потребоваться ~$N$ итераций. Решение — preconditioner.

</details>

<details>
<summary><b>Q:</b> Что такое eigenvalue и eigenvector?</summary>

$\lambda$ и $x \ne 0$ такие, что $Ax = \lambda x$ — A лишь масштабирует $x$. Eigenvalues — корни $\det(A - \lambda I) = 0$.

</details>

<details>
<summary><b>Q:</b> Что такое preconditioning и как выбрать preconditioner $M$?</summary>

Вместо $Ax=b$ решать $M^{-1}Ax = M^{-1}b$. Требования: (A) $Mz = r$ легко решать; (B) $B = M^{-1}A$ лучше обусловлена: $\kappa_2(B) < \kappa_2(A)$.

</details>

<details>
<summary><b>Q:</b> Что такое condition number $\kappa_2$ (по слайдам)?</summary>

$\kappa_2$ = largest eigenvalue / smallest eigenvalue. Чем меньше, тем быстрее сходятся iterative методы.

</details>

<details>
<summary><b>Q:</b> Каковы крайние случаи preconditioner и почему они плохи?</summary>

- $M = I$: $Mz=r$ тривиально, но обусловленность не улучшается.
- $M = A$: идеальная обусловленность ($\kappa=1$), но решить $Mz=r$ так же трудно, как исходную задачу.

</details>

<details>
<summary><b>Q:</b> Опишите classical alternating Schwarz method.</summary>

Schwarz, 1870. Область = объединение двух перекрывающихся регулярных $\Omega_1$, $\Omega_2$ (где работает spectral method). Итеративно и **по очереди** решается Poisson в $\Omega_1$ с граничным условием на $\Gamma_1$ из последнего $u_2$, затем в $\Omega_2$ с условием на $\Gamma_2$ из нового $u_1$. Также называется **multiplicative overlapping Schwarz method**.

</details>

<details>
<summary><b>Q:</b> Запишите уравнение Пуассона с граничным условием Дирихле.</summary>

$-\Delta u = f$ в $\Omega$, $u = g$ на $\Gamma$; $\Delta u = u_{xx} + u_{yy}$. $u$ — температура, электромагнитный потенциал, прогиб мембраны.

</details>

<details>
<summary><b>Q:</b> Какова variational formulation для FEM-решения уравнения Пуассона?</summary>

Найти $u_h \in V_h$ (кусочно-линейные функции, 0 на $\Gamma$): $a(u_h, v) = (f, v)\ \forall v\in V_h$, где $a(u,v) = \int_\Omega \nabla u\cdot\nabla v\,dx$. Тестовые функции — hat-functions $\varphi_i$ ($\varphi_i(x_i)=1$, $\varphi_i(x_j)=0$).

</details>

<details>
<summary><b>Q:</b> Какую структуру имеет Laplace matrix на регулярной сетке $n\times n$?</summary>

$n^2\times n^2$, блочно-трёхдиагональная: диагональные блоки $B = \mathrm{tridiag}(-1, 4, -1)$, внедиагональные $-I$. Каждая строка: 4 на диагонали, −1 для (до) 4 соседей.

</details>

<details>
<summary><b>Q:</b> Запишите шаги одной итерации PCG.</summary>

1. solve $Mz = r$
2. $\rho = r^T z$
3. $\beta = \rho_{i-1}/\rho_{i-2}$, $p = z + \beta p$ (на первой итерации $p = z$)
4. $q = Ap$
5. $\alpha = \rho/(p^T q)$
6. $x = x + \alpha p$, $r = r - \alpha q$
7. проверка сходимости

</details>

<details>
<summary><b>Q:</b> Какие ограничения на A и M у CG/PCG?</summary>

CG ($M = I$) сходится только для **symmetric** (positive definite) $A$. В PCG применение $M^{-1}$ также должно быть **symmetric**.

</details>

<details>
<summary><b>Q:</b> Какие операции PCG требуют коммуникации при параллелизации и какой?</summary>

- matrix-vector $Ap$ — обмен граничными значениями с соседями (parallel version);
- dot products (2 на итерацию) — global reduction, **all-to-all communication**;
- preconditioner solve — зависит от $M$ (должен быть symmetric, параллелизуемый, легко решаемый).
axpy-обновления — локальны.

</details>

<details>
<summary><b>Q:</b> Какую операцию PCG можно реализовать со скрытием коммуникации за вычислениями?</summary>

Matrix-vector product: начать non-blocking обмен граничными значениями, вычислять внутренние точки подобласти, затем досчитать граничные. Dot product требует глобальной синхронизации (all-reduce) — скрыть сложнее.

</details>

<details>
<summary><b>Q:</b> Что такое Block-Jacobi preconditioner и в чём его недостаток?</summary>

$M = \mathrm{diag}(M_1, M_2)$ с $M_1 = A_{11}^{-1}$, $M_2 = A_{22}^{-1}$ — диагональные блоки (подобласти без перекрытия) решаются независимо и параллельно. Недостаток: $\kappa_2(B) \sim \kappa_2(A)$ — обусловленность почти не улучшается.

</details>

<details>
<summary><b>Q:</b> Что такое restriction operator $R_i$?</summary>

Матрица, которая из глобального вектора $\mathbf{x}$ извлекает компоненты подобласти $\Omega_i$: $\mathbf{x}_i = R_i\mathbf{x}$. $R_i^T$ продолжает локальный вектор обратно в глобальный (нулями вне $\Omega_i$).

</details>

<details>
<summary><b>Q:</b> Запишите one-level Additive Schwarz preconditioner.</summary>

$$M_i^{-1} = R_i^T (R_i A R_i^T)^{-1} R_i,\qquad M_{1AS}^{-1} = \sum_{i=1}^{P} M_i^{-1}$$
$A_i = R_i A R_i^T$ — матрица подобласти, $A_i^{-1}$ — subdomain solve.

</details>

<details>
<summary><b>Q:</b> Additive vs multiplicative Schwarz?</summary>

- **Multiplicative** (alternating): подобласти решаются **последовательно**, каждая использует свежие значения от предыдущих.
- **Additive**: все subdomain solves независимы и выполняются **параллельно**, затем результаты **складываются на перекрытиях**.

</details>

<details>
<summary><b>Q:</b> Exact vs inexact subdomain solvers? Примеры inexact.</summary>

Exact — точное решение $A_i^{-1}$ (например, LU). Inexact — приближённое: (symmetric) Gauss-Seidel, ILU (Incomplete LU). Для CG нужна symmetry $M^{-1}$, поэтому symmetric Gauss-Seidel.

</details>

<details>
<summary><b>Q:</b> Что такое two-level Additive Schwarz и зачем coarse grid?</summary>

Добавляется coarse-grid term $M_0^{-1} = R_0^T (R_0 A R_0^T)^{-1} R_0$:
$$M_{2AS}^{-1} = \sum_{i=0}^{P} M_i^{-1}$$
Coarse grid обеспечивает глобальный обмен информацией между подобластями (одноуровневый метод передаёт её лишь между соседями, и сходимость ухудшается с ростом числа подобластей).

</details>

<details>
<summary><b>Q:</b> Как определяются $R_0$ и $A_0$ в двухуровневом методе?</summary>

$R_0^T$ — интерполяция (линейная/билинейная) с coarse grid на fine grid; $R_0$ — её транспонированный (restriction). $A_0$ собирается аналитически или $A_0 = R_0 A R_0^T$.

</details>

<details>
<summary><b>Q:</b> Какие требования к coarse grid?</summary>

1. Покрывать все узлы fine grid.
2. Каждая coarse-ячейка должна содержать узлы fine grid.
3. При неравномерной плотности fine grid coarse grid адаптируется по числу узлов в ячейках.

</details>

<details>
<summary><b>Q:</b> Почему domain decomposition хорошо параллелится?</summary>

Каждая подобласть — локальная задача на своём процессоре; subdomain solves независимы (additive Schwarz), matrix-vector требует обмена лишь граничными/overlap значениями с соседями, а глобальная коммуникация нужна только для dot products (и coarse problem).

</details>
