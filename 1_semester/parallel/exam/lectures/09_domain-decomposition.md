# Лекция 09: Domain Decomposition Method

Слайды: lecture-slides.pdf, стр. 160–175

## Контекст
- **Domain decomposition** — data decomposition больших научных и инженерных задач: физическая область (mesh) делится на подобласти (subdomains), каждая — на свой процессор. Применяется как метод решения линейных систем со **sparse matrices** (примеры: CFD, нефтяные пласты, обтекание самолёта и т.п.).

## Решение больших разреженных линейных систем $Ax = b$
**Serial direct solvers** (относительная стоимость этапов):
- анализ для лучшего упорядочивания неизвестных (ordering) — ~100 time units;
- sparse **LU-factorisation** — ~10 time units;
- решение треугольных систем — ~1 time unit.

**Serial iterative methods**: Gauss-Seidel; **Conjugate Gradient (CG)**; **GMRES** (General Minimal RESidual).

**Parallel solvers**:
- direct — например, **MUMPS**;
- iterative — самые эффективные основаны на **Krylov subspace methods**: **PCG** (Preconditioned CG), **PGMRES**, **FGMRES** (Flexible PGMRES).
- Для больших задач нужны **хорошие preconditioners** и параллелизация ⇒ **domain decomposition preconditioner techniques**.

## Classical alternating Schwarz method
- **Hermann Amandus Schwarz, 1870**. Решал уравнение Пуассона spectral method — доступно только на **регулярных** областях (круг, прямоугольник), поэтому сложную область представил как объединение двух **перекрывающихся** регулярных: $\Omega_1$ (круг) и $\Omega_2$ (прямоугольник); $\Gamma_1$ — часть границы $\Omega_1$ внутри $\Omega_2$, $\Gamma_2$ — часть границы $\Omega_2$ внутри $\Omega_1$.
- **Alternating iterative process** (также **multiplicative overlapping Schwarz method**), итерация $n$:
  $$-\nabla^2 u_1^n = f_1 \text{ в } \Omega_1,\quad u_1^n = g \text{ на } \partial\Omega_1\setminus\Gamma_1,\quad u_1^n = u_2^{n-1}|_{\Gamma_1} \text{ на } \Gamma_1$$
  $$-\nabla^2 u_2^n = f_2 \text{ в } \Omega_2,\quad u_2^n = g \text{ на } \partial\Omega_2\setminus\Gamma_2,\quad u_2^n = u_1^{n}|_{\Gamma_2} \text{ на } \Gamma_2$$
- Подобласти решаются **по очереди** (multiplicative) — каждая использует свежее граничное значение от другой.

## Почему iterative методы и зачем preconditioner
- Для больших sparse систем iterative методы лучше из-за **memory restrictions** и **sparsity**.
- Но скорость сходимости зависит от **спектра** (распределения eigenvalues) матрицы.
- Пример: $N = 10^6$ ⇒ число итераций порядка $N$ — 1 миллион итераций, слишком много ⇒ решение: **preconditioner**.
- **Eigenvalues**: скаляры $\lambda$, для которых $\exists x \ne 0$: $Ax = \lambda x$ (A лишь масштабирует eigenvector); корни характеристического уравнения $\det(A - \lambda I) = 0$ ($A - \lambda I$ singular).

## Preconditioners
- Вместо $Ax = b$ решаем $M^{-1}Ax = M^{-1}b$.
- Как выбрать $M$:
  - A. задача $Mz = r$ должна **легко решаться**;
  - B. $B = M^{-1}A$ должна быть **лучше обусловлена**, чем $A$: $\kappa_2(B) < \kappa_2(A)$, где **condition number** $\kappa_2$ = {largest eigenvalue}/{smallest eigenvalue}.
- Крайние случаи: $M = I$ (решать легко, но улучшения нет) и $M = A$ (идеальная обусловленность, но решать $Mz=r$ так же трудно, как исходную задачу). Хороший preconditioner — компромисс.

## Пример: FEM для уравнения Пуассона
- **Poisson equation**: $-\Delta u(\mathbf{x}) = f(\mathbf{x})\ \forall \mathbf{x}\in\Omega$, $u(\mathbf{x}) = g(\mathbf{x})\ \forall \mathbf{x}\in\Gamma$; $\Delta u = \frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2}$.
- $u$ — например, температура, электромагнитный потенциал, прогиб упругой мембраны, закреплённой на границе, под поперечной нагрузкой.
- На единичном квадрате: $-u_{xx} - u_{yy} = f$, $0 \le x, y \le 1$.
- **Variational formulation**: $V_h$ — пространство кусочно-линейных функций на $\Omega$, нулевых на $\Gamma$, со значениями во внутренних узлах. Найти $u_h \in V_h$:
  $$a(u_h, v) = (f, v)\quad \forall v \in V_h,\qquad a(u,v) = \int_\Omega \nabla u\cdot\nabla v\,dx$$
- Тестовые функции — **hat-functions** $\varphi_i$: $\varphi_i(x_i) = 1$, $\varphi_i(x_j) = 0$ при $j \ne i$; требуем выполнения (1) для каждого $v = \varphi_i$, $i = 1..N$ ⇒ линейная система.
- Для регулярной сетки — $n^2\times n^2$ **Laplace matrix** (блочно-трёхдиагональная):
  $$A = \begin{bmatrix} B & -I & & \\ -I & B & \ddots & \\ & \ddots & \ddots & -I \\ & & -I & B\end{bmatrix},\quad B = \begin{bmatrix} 4 & -1 & & \\ -1 & 4 & \ddots & \\ & \ddots & \ddots & -1 \\ & & -1 & 4\end{bmatrix}$$
  (5-point stencil: 4 на диагонали, −1 для соседей.)

## Preconditioned Conjugate Gradient (PCG)
```
r(0) = b - A x(0)                     # начальная невязка
for i = 1, 2, ...
    solve M z(i-1) = r(i-1)           # preconditioner solve (M^-1 — preconditioner)
    rho(i-1) = r(i-1)^T z(i-1)        # dot product
    if i == 1: p(1) = z(0)
    else:
        beta(i-1) = rho(i-1) / rho(i-2)
        p(i) = z(i-1) + beta(i-1) p(i-1)
    q(i) = A p(i)                     # matrix-vector
    alpha(i) = rho(i-1) / (p(i)^T q(i))   # dot product
    x(i) = x(i-1) + alpha(i) p(i)
    r(i) = r(i-1) - alpha(i) q(i)
    check convergence
```
- $M = I$ ⇒ обычный **CG**; CG сходится только для **symmetric** $A$ (точнее symmetric positive definite).
- В **PCG** применение $M^{-1}$ тоже должно быть **symmetric**.

### Параллелизация PCG
| Операция | Параллелизация |
|---|---|
| **matrix-vector** $q = Ap$ | параллельная версия операции (обмен граничными значениями между соседними подобластями) |
| **dot product** | параллелизуема (локальные суммы), но требует **all-to-all communication** (global reduction) |
| **preconditioner solve** $Mz = r$ | нужен подходящий $M$: **symmetric**, **допускающий параллелизацию**, **легко решаемый** |
| axpy-обновления $x$, $r$, $p$ | локальные, без коммуникации |
- Вопрос: какие операции можно реализовать со скрытием коммуникации за вычислениями? — matrix-vector (non-blocking обмен границами, пока считаются внутренние точки; см. лекцию 4 «overlapping communication and computations»).

## Block-Jacobi method
- $A = \begin{bmatrix} A_{11} & A_{12} \\ A_{21} & A_{22}\end{bmatrix}$ (две подобласти $\Omega_1$, $\Omega_2$ без перекрытия).
- Preconditioner $M = \operatorname{diag}(M_1, M_2)$, например $M_1 = A_{11}^{-1}$, $M_2 = A_{22}^{-1}$ — блоки решаются независимо (параллельно).
- **Но всё ещё $\kappa_2(B) \sim \kappa_2(A)$** — обусловленность почти не улучшается.

## One-level Additive Schwarz preconditioner
- $N$ (или $P$) **перекрывающихся** подобластей (пример: 3×3 = 9 подобластей $\Omega_1..\Omega_9$).
- **Restriction operator** $R_i$ — матрица, которая из глобального вектора $\mathbf{x}$ выбирает компоненты подобласти $\Omega_i$: $\mathbf{x}_i = R_i\mathbf{x}$. $R_i^T$ — продолжение обратно (нулями).
- Локальная матрица $A_i = R_i A R_i^T$; $A_i^{-1}$ — **i-th subdomain solve**.
  $$M_i^{-1} \stackrel{def}{=} R_i^T (R_i A R_i^T)^{-1} R_i,\quad i = 1..P$$
  $$M_{1AS}^{-1} \stackrel{def}{=} \sum_{i=1}^{P} M_i^{-1}$$
- **Additive** — все подобласти решаются **одновременно/независимо** (параллельно), затем результаты **складываются на перекрытиях** (в отличие от multiplicative — последовательно).
- Subdomain solvers — **exact** или **inexact**; типичные inexact: (symmetric) **Gauss-Seidel**, **ILU** (Incomplete LU-factorization).
- Для CG **symmetry $M^{-1}$ — обязательное условие** (поэтому symmetric Gauss-Seidel).
- Пример на слайде: регулярная 2D сетка, $P = p^2$ подобластей; при $p = 3$ — 9 подобластей ($P_0..P_8$), каждая решает свою подзадачу, значения на overlaps суммируются.

## Multilevel (two-level) methods — coarse grid
- Одноуровневый метод передаёт информацию только между соседями ⇒ с ростом числа подобластей сходимость ухудшается; **coarse grid** обеспечивает глобальный обмен информацией.
- **Interpolation operator** $R_0^T$ — линейно (билинейно) интерполирует значения с coarse grid на узлы fine grid; **restriction** $R_0$ — его транспонированный.
- **Coarse grid matrix** $A_0$: собирается аналитически или по формуле $A_0 = R_0 A R_0^T$.
  $$M_0^{-1} \stackrel{def}{=} R_0^T A_0^{-1} R_0 = R_0^T (R_0 A R_0^T)^{-1} R_0$$
- **Two-level Additive Schwarz**:
  $$M_{2AS}^{-1} = \sum_{i=0}^{P} M_i^{-1}$$
  (сумма с $i=0$ — добавлен coarse-grid term.)
- **Требования к coarse grid**:
  - покрывать все узлы fine grid;
  - каждая ячейка coarse grid должна содержать узлы fine grid;
  - при неравномерной плотности fine grid coarse grid должна адаптироваться по числу узлов в ячейке.

## In-class exercise 9
- Интерактивное приложение «DD Schwarz Lab» (domain decomposition learning explorer) — оценка учебного материала.
