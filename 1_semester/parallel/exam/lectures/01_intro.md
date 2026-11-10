# Лекция 01: Introduction to parallel computing

Слайды: lecture-slides.pdf, стр. 1–11

## Организация курса
- Лектор: Eero Vainikko. Лекции — четверг, практики (computer classes) — пятница.
- Итоговая оценка: practicals/assignments **50%** + exam **50%**.
- Экзамен — **blackboard exam** (у доски), 11 и 18 декабря. Оценивается: Knowledge, Understanding, Presentation, Written content.
- Практики: Python & numpy → OpenMP → Shaders → MPI (send/receive, blocking/non-blocking, collectives, Ax, matrix multiplication, manager-worker, MPI+OpenMP, parallel solves) → GPGPU → Spark (RDD, DataFrames, graph processing).

## Терминология: concurrency vs parallelism vs distributed
- **Concurrency** — несколько задач *делают прогресс в перекрывающиеся периоды времени*; одновременное выполнение **не требуется** (можно чередовать на одном ядре).
- **Parallelism** — несколько операций *выполняются одновременно* (физически в один момент времени).
- **Distributed computing** — компоненты на компьютерах, соединённых сетью, координируются, обычно через **messages**.
- Соотношение областей (диаграмма на слайде): Concurrent Computing ⊃ Parallel Computing; Distributed Computing пересекается с ними; рядом — Concurrent/Parallel Programming Languages, Network Programming.
- Вопросы для обсуждения (типичные «на понимание»):
  - Обязательно ли асинхронный web-server параллельный? — Нет: он concurrent (много запросов «в процессе»), но может работать на одном потоке (event loop).
  - Является ли GPU kernel distributed? — Нет: он массивно parallel, но выполняется на одном устройстве с общей памятью, без обмена сообщениями по сети.
  - Многополосный перекрёсток: машины на разных полосах едут одновременно (parallelism); светофор чередует потоки через общий перекрёсток (concurrency).

## История вычислений
- ~3000 B.C. — **abacus** (Вавилон); китайский abacus ~200 B.C.
- **Charles Babbage** (1791–1871), «father of computer»: механический **Difference engine**; 1837 — концепция программируемого **Analytical engine** (mechanical general purpose computer).
- **Ada Lovelace** (1815–1852) — считается автором первой general-purpose программы для analytical engine.
- **Luigi Federico Menabrea** (1809–1896) — в 1842 описал analytical engine + **параллельное расширение**: независимые команды выполняются одновременно → ускорение.
- Параллельные вычисления существовали до электронных компьютеров:
  - **1922 — Lewis Fry Richardson, «forecast factory»**: видение 64 000 «человеческих вычислителей», параллельно считающих разные регионы для прогноза погоды. Его первый численный прогноз (один человек) занял > 6 недель ради прогноза на 6 часов.
  - 1940 — параллельные вычисления в военной промышленности на механических устройствах (Felix).
  - 1940-е — первые электронные компьютеры на вакуумных лампах; 1945 — **ENIAC** и др.
- Эпохи: 1960 — mainframes (IBM); 1970 — minis; 1980 — PCs; 1990 — parallel computers; 2000 — clusters/grids; 2010… — cloud computing; 202x — quantum computers?

## Предсказания экспертов (и почему они ошибались)
- 1947, Howard Aiken (легенда): США понадобится максимум 6 компьютеров.
- 1977, Seymour Cray: Cray-1 найдёт лишь ~100 клиентов в мире.
- 1980, IBM: в год можно продать максимум ~50 компьютеров класса Cray.
- Реальность: смартфон в кармане мощнее многих Cray. Cray-1: peak **160 MFLOPS**, 1 млн слов памяти; Cray-2: **1.9 GFLOPS**, 256 млн слов.

## Moore's law
- **1965**, Gordon Moore (основатель Intel): число переключателей (транзисторов) на чипе удваивается примерно **каждый год**.
- **1975** — уточнение: удваивается **каждые два года**.
- Экстраполяция: к ~2030 достигли бы атомарного уровня.
- Важно: **Moore's law — про плотность интеграции, а не про clock speed и не про производительность приложений**.

## Thought experiment (почему всё стало параллельным)
- Цикл `for i in range(10**12): z[i] = x[i] + y[i]` → $3\cdot10^{12}$ обращений к памяти (2 load + 1 store).
- FP64: ≥ 24 байта на итерацию → ~24 TB memory traffic.
- Чтобы закончить за 1 с при скорости сигнала = скорость света $3\cdot10^8$ м/с, среднее расстояние до ячейки памяти:
  $$r = \frac{3\cdot10^8\,\text{м/с}\cdot 1\,\text{с}}{3\cdot10^{12}} = 10^{-4}\,\text{м}$$
- Если память — квадратная сетка из $3\cdot10^{12}$ ячеек в круге радиуса $r$, ребро ячейки:
  $$\frac{2\cdot10^{-4}\,\text{м}}{\sqrt{3\cdot10^{12}}} \approx 10^{-10}\,\text{м}$$
  — размер атома ⇒ последовательный процессор так не ускорить.
- Вывод слайда: **power, memory и communication constraints** — главные причины, по которым вычисления стали всё более параллельными.
