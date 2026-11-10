# Лекция 02: Motivation for parallel computing and HPC

Слайды: lecture-slides.pdf, стр. 12–31

## HPC applications (in-class exercise 1)
- Области: modeling, simulation, design, signal processing, engineering, geology, tectonics, …
- Шаблон анализа HPC-приложения: какую задачу решает; какие units of work выполняются параллельно; количественный масштаб/результат; почему одного компьютера недостаточно.

## Computer simulation — главный драйвер HPC
**Почему симуляция, а не реальный эксперимент:**
- **Inaccessible / non-repeatable** — слияние чёрных дыр, недра Земли.
- **Dangerous / destructive** — краш-тесты, взрывы, тяжёлые аварии реакторов.
- **Ethically constrained** — лечение пациентов, вмешательства в экосистемы.
- **Too expensive** — самолёты, корабли, offshore-платформы.
- **Too slow or too fast to observe** — геология, климат, движение молекул.

**Почему симуляции нужен HPC:**
- **Scale and resolution** — миллиарды ячеек/частиц/неизвестных.
- **Deadline** — результат полезен, только если получен вовремя (прогноз погоды).
- **Ensembles and uncertainty** — десятки–тысячи связанных прогонов.
- **Optimisation** — перебор множества вариантов дизайна/параметров.
- **Data volume and velocity** — обработка экспериментальных/наблюдательных потоков.
- **Multiphysics and multiscale coupling**.

**Примеры по категориям (слайды):**
- Нельзя воспроизвести/контролировать: столкновение чёрных дыр (LIGO: слияние ~36 и ~29 солнечных масс, ~3 массы Солнца ушли в гравитационные волны — «нельзя перезапустить Вселенную с другими массами»).
- HIGH COST OF THE REAL EXPERIMENT: car crash-tests, взрывы газа, ядерные взрывы, корабли в океанских волнах, аэродинамика самолётов, прочность больших конструкций (нефтяные платформы).
- TIME FACTOR: изменение климата, геологическое развитие Земли (oil-field simulation), glacier flow, weather prediction.
- SCALE OF THE PROBLEM: рыба в норвежских фьордах (осадки → пресная вода/солёность → течения → планктон → рыба), химические реакции на молекулярном уровне, экосистемы, модели сердца, мозга, глобальной экономики.

## HPC beyond scientific simulation
- Commercial: нефтяная индустрия (reservoir simulation), **Monte Carlo** risk analysis и option pricing, глобальная экономика, автопром (crash-tests), авиация.
- Computer systems: **Large Language Models**, computer security (обнаружение сетевых атак), cryptography, HPC-assisted design/training/verification автономных и embedded систем. Итог: «data, security and AI».

## FLOPS — шкала
| Приставка | Значение | Пример |
|---|---|---|
| — | $10^2$ FLOP/s | первые компьютеры |
| Giga | $10^9$ (GFLOP/s) | desktop |
| Tera | $10^{12}$ (TFLOP/s) | прошлые суперкомпьютеры / современные desktop GPU |
| Peta | $10^{15}$ (PFLOP/s) | быстрые кластеры |
| Exa | $10^{18}$ (EFLOP/s) | лидер TOP500 2026 |
| Zetta | $10^{21}$ | следующий шаг |
| Yotta | $10^{24}$ | дальняя цель |

## Пример: прогноз погоды для Европы (как параллельные компьютеры помогают)
- 48 часов, от уровня моря до 20 км; PDE в 3D, шаги по времени.
- Объём: $5000\times4000\times20$ км³. Шаг сетки: 1 км по xy, 0.1 км по z ⇒ 10 ячеек на км³.
- Meshpoints: $5000\cdot4000\cdot20\cdot10 = 4\cdot10^{9}$.
- Timesteps: шаг 1 мин ⇒ $48\cdot60 = 2880$; ~$10^3$ flop на точку за шаг.
- Всего: $4\cdot10^9\cdot2880\cdot10^3 \approx 1.152\cdot10^{16}$ flop.
- На **1 GFLOP/s**: $1.152\cdot10^{7}$ с ≈ **133 дня** (бесполезно для прогноза!).
- На **1 TFLOP/s**: $1.152\cdot10^{4}$ с ≈ **3.2 часа**.
- Уточнение: шаг 0.1 км по xy (×100 точек) и шаг по времени 10 с (×6) ⇒ ×600 ⇒ с 3.2 ч до **80 дней**.
- Можно заменить Европу (~$2\cdot10^7$ км²) на весь мир (~$5\cdot10^8$ км²) и добавить модель океана.
- Мораль: потребности науки растут быстрее возможностей — достаточно уменьшить $\tau$ (шаг по времени) и $h$ (шаг сетки), и мощности снова не хватает.

## AI и прогноз погоды
- **GraphCast** (Lam et al., Science, 2023): learned **message passing** на multiresolution сферическом графе; **дополняет** PDE-расчёт, а не заменяет.
- ECMWF с февраля 2025 эксплуатирует AI-модель **AIFS** рядом с традиционной физической **IFS**.
- Вопрос «устранил ли AI нужду в HPC?» — нет: обучение и физическая модель всё равно требуют HPC.

## Every computer is a parallel computer — почему
- Параллелизм внутри: глубокая микроархитектура процессора, multiple cores, несколько multicore-процессоров, GPU.
- Причины:
  - Невозможно дальше повышать частоты (processor, memory).
  - **Power consumption растёт с частотой**, а energy efficiency падает.
  - Параллелизм даёт больше throughput и **performance per watt**, когда frequency scaling ограничен мощностью.
- Почти все компьютеры параллельны аппаратно: multiple functional units (FP, GPU, integer), multiple execution units/cores, multiple hardware threads.
- **Четыре уровня параллелизма**: 1) instruction-level; 2) SIMD/data-level; 3) core-level; 4) node-level.
- Пример Fugaku: Armv8.2-A SVE 512 bit, 48 (+2 assistant) cores, 4 L2 cache units.

## HPC systems
- **Определение**: HPC — использование parallel algorithms, system software и computing hardware для решения вычислительно- или data-intensive задач **в рамках ограничений по времени, энергии или стоимости**.
- Свойства: всегда на передовой технологий; конкурентное развитие; дорого; технологии со временем становятся commodity; research-intensive; движимо наукой и индустрией; спрос на производительность постоянно растёт.
- Типичная система: много CPU/GPU, high-bandwidth memory, **low-latency interconnects**, parallel storage, schedulers, оптимизированные численные библиотеки.

## Примеры суперкомпьютеров и clusters
- IBM Blue Gene (Mira, Argonne): #3 в TOP500 (июнь 2012), #24 (июнь 2019).
- **Computer cluster** — набор похожих вычислительных узлов, соединённых быстрой сетью. Первые — **Beowulf clusters** (проект NASA 1993–94; название от древнеанглийского эпоса).
- Современная архитектура: **LUMI** (Эстония — член консорциума; №11 в списке июня 2026).

## TOP500
- Рейтинг суперкомпьютеров по **HPL (Linpack)**: Rmax, Rpeak, power; статистика (performance development, over time, treemaps).
- In-class exercise 2: для системы из TOP10 — rank/site/application, CPU/GPU + interconnect, cores, Rmax, Rpeak, power, **Rmax/Rpeak**, архитектурный trade-off, **почему HPL rank не предсказывает производительность для любого приложения** (HPL — плотная линейная алгебра, compute-bound; реальные приложения часто memory/communication-bound).
