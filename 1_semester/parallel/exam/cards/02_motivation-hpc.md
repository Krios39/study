# Карточки — Лекция 02: Motivation for parallel computing and HPC

<details>
<summary><b>Q:</b> Дайте определение High-Performance Computing (HPC) по слайдам.</summary>

HPC — использование parallel algorithms, system software и computing hardware для решения computationally или data-intensive задач **в рамках ограничений по времени, энергии или стоимости**.

</details>

<details>
<summary><b>Q:</b> Почему симулируют, а не проводят реальный эксперимент? (5 причин)</summary>

1. Inaccessible / non-repeatable (слияние чёрных дыр, недра Земли)
2. Dangerous / destructive (краш-тесты, взрывы, аварии реакторов)
3. Ethically constrained (пациенты, экосистемы)
4. Too expensive (самолёты, корабли, offshore-структуры)
5. Too slow / too fast to observe (геология, климат, молекулы)

</details>

<details>
<summary><b>Q:</b> Почему симуляции требуют HPC? (6 причин)</summary>

Scale and resolution (миллиарды неизвестных); deadline (результат нужен вовремя); ensembles and uncertainty (много прогонов); optimisation (много вариантов дизайна); data volume and velocity; multiphysics and multiscale coupling.

</details>

<details>
<summary><b>Q:</b> Назовите применения HPC за пределами научной симуляции.</summary>

Oil industry (reservoir simulation), Monte Carlo risk analysis и option pricing, global economy, автопром, авиация; LLMs, computer security (сетевые атаки), cryptography, проектирование/обучение/верификация autonomous и embedded систем.

</details>

<details>
<summary><b>Q:</b> Перечислите приставки FLOPS от Giga до Yotta с показателями степени.</summary>

Giga $10^9$, Tera $10^{12}$, Peta $10^{15}$, Exa $10^{18}$, Zetta $10^{21}$, Yotta $10^{24}$ FLOP/s. Лидер TOP500 2026 — уровень Exa.

</details>

<details>
<summary><b>Q:</b> Прогноз погоды для Европы: сколько meshpoints при объёме $5000\times4000\times20$ км³, шаге 1 км по xy и 0.1 км по z?</summary>

10 ячеек на км³ ⇒ $5000\cdot4000\cdot20\cdot10 = 4\cdot10^9$ meshpoints.

</details>

<details>
<summary><b>Q:</b> Прогноз на 48 ч с шагом 1 мин, ~1000 flop на точку за шаг, $4\cdot10^9$ точек. Сколько всего flop и сколько времени на 1 GFLOP/s и на 1 TFLOP/s?</summary>

$4\cdot10^9\cdot(48\cdot60)\cdot10^3 = 1.152\cdot10^{16}$ flop.
- GFLOP/s: $1.152\cdot10^7$ с ≈ **133 дня**
- TFLOP/s: $1.152\cdot10^4$ с ≈ **3.2 часа**

</details>

<details>
<summary><b>Q:</b> Как изменится время прогноза (3.2 ч на TFLOP/s), если шаг по xy уменьшить до 0.1 км, а шаг по времени — до 10 с?</summary>

Точек ×100 (по x и y в 10 раз), шагов по времени ×6 ⇒ работа ×600 ⇒ $3.2\cdot600 = 1920$ ч ≈ **80 дней**.

</details>

<details>
<summary><b>Q:</b> Что такое GraphCast и заменил ли AI HPC в прогнозе погоды?</summary>

GraphCast (Lam et al., 2023) — learned message passing на multiresolution spherical graph. Он **дополняет** PDE-расчёт; ECMWF с 2025 запускает AI-модель AIFS параллельно с физической IFS. HPC по-прежнему нужен (обучение, физические модели).

</details>

<details>
<summary><b>Q:</b> Почему «every computer is a parallel computer»? Причины перехода к параллелизму.</summary>

- Невозможно дальше поднимать частоты processor и memory.
- Power consumption растёт с частотой, energy efficiency падает.
- Параллелизм даёт больший throughput и performance per watt при power-limited frequency scaling.

</details>

<details>
<summary><b>Q:</b> Назовите четыре уровня параллелизма в современном компьютере.</summary>

1. Instruction-level
2. SIMD / data-level
3. Core-level
4. Node-level

</details>

<details>
<summary><b>Q:</b> Перечислите типичные компоненты HPC-системы.</summary>

Много CPU/GPU compute units, high-bandwidth memory, low-latency interconnects, parallel storage, schedulers, оптимизированные численные библиотеки.

</details>

<details>
<summary><b>Q:</b> Что такое computer cluster и Beowulf cluster?</summary>

Cluster — набор похожих вычислительных узлов, соединённых быстрой сетью. Beowulf clusters — первые такие системы из commodity-узлов (проект NASA, 1993–94).

</details>

<details>
<summary><b>Q:</b> Что такое TOP500 и по какому бенчмарку составляется?</summary>

Рейтинг 500 самых быстрых суперкомпьютеров по **HPL (High Performance Linpack)**: Rmax (достигнутая), Rpeak (пиковая), энергопотребление.

</details>

<details>
<summary><b>Q:</b> Почему место системы в рейтинге HPL может не предсказывать её производительность на любом приложении?</summary>

HPL — плотная линейная алгебра, compute-bound, с высоким переиспользованием данных. Многие реальные приложения memory-bound или communication-bound (sparse, irregular), поэтому Rmax для них не показателен (отсюда HPCG, Graph500 и др.).

</details>

<details>
<summary><b>Q:</b> Что показывает отношение Rmax/Rpeak?</summary>

Долю пиковой теоретической производительности, реально достигнутую на HPL, то есть эффективность системы на этом бенчмарке.

</details>

<details>
<summary><b>Q:</b> Какой суперкомпьютер связан с Эстонией и какое у него место?</summary>

**LUMI** — Эстония член консорциума LUMI; в списке TOP500 июня 2026 — №11.

</details>
