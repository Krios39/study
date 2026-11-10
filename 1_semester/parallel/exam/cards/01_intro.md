# Карточки — Лекция 01: Introduction to parallel computing

<details>
<summary><b>Q:</b> Чем concurrency отличается от parallelism?</summary>

- **Concurrency** — несколько задач делают прогресс в перекрывающиеся периоды времени; одновременное выполнение не требуется (можно чередовать на одном ядре).
- **Parallelism** — несколько операций выполняются физически одновременно.

</details>

<details>
<summary><b>Q:</b> Дайте определение distributed computing.</summary>

Компоненты на компьютерах, соединённых сетью, координируют работу, обычно путём обмена **messages**.

</details>

<details>
<summary><b>Q:</b> Обязательно ли асинхронный web-server является parallel?</summary>

Нет. Он **concurrent** (много запросов обрабатываются в перекрывающиеся периоды), но может работать на одном потоке через event loop, без одновременного выполнения.

</details>

<details>
<summary><b>Q:</b> Является ли GPU kernel distributed?</summary>

Нет. Он массивно **parallel**, но работает на одном устройстве (общая память GPU), без координации компьютеров через сеть сообщениями.

</details>

<details>
<summary><b>Q:</b> Как распределяется итоговая оценка и какой формат экзамена?</summary>

Practicals/assignments 50% + exam 50%. Экзамен — **blackboard exam** (11 и 18 декабря); оцениваются knowledge, understanding, presentation, written content.

</details>

<details>
<summary><b>Q:</b> Кто такой Charles Babbage и что он изобрёл?</summary>

«Father of computer» (1791–1871): механический **Difference engine**, а в 1837 — концепция программируемого **Analytical engine** (mechanical general purpose computer).

</details>

<details>
<summary><b>Q:</b> Какой вклад внесли Ada Lovelace и Luigi Menabrea?</summary>

- **Ada Lovelace** — считается автором первой general-purpose программы для analytical engine.
- **Menabrea** (1842) — описал analytical engine и **параллельное расширение**: независимые команды выполняются одновременно, ускоряя вычисления.

</details>

<details>
<summary><b>Q:</b> Что такое «forecast factory» Lewis Fry Richardson (1922)?</summary>

Видение параллельного прогноза погоды «человеческими массивами»: ~64 000 human computers считают разные регионы параллельно. Его одиночный численный прогноз занял > 6 недель ради прогноза на 6 часов. Пример параллельных вычислений до электронных компьютеров.

</details>

<details>
<summary><b>Q:</b> Перечислите эпохи вычислений по десятилетиям (по слайдам).</summary>

1960 mainframes (IBM) → 1970 minis → 1980 PCs → 1990 parallel computers → 2000 clusters/grids → 2010+ cloud computing → 202x quantum computers?

</details>

<details>
<summary><b>Q:</b> Приведите примеры неудачных экспертных прогнозов о компьютерах.</summary>

- 1947 Howard Aiken (легенда): США понадобится максимум 6 компьютеров.
- 1977 Seymour Cray: у Cray-1 будет ~100 клиентов.
- 1980 IBM: максимум ~50 Cray-class компьютеров в год.
Реальность: в кармане мощность многих Cray (Cray-1 — 160 MFLOPS, Cray-2 — 1.9 GFLOPS).

</details>

<details>
<summary><b>Q:</b> Сформулируйте Moore's law (1965 и уточнение 1975).</summary>

- 1965: число switches (транзисторов) на чипе удваивается примерно **каждый год**.
- 1975: удваивается **каждые два года**.

</details>

<details>
<summary><b>Q:</b> Описывает ли Moore's law рост тактовой частоты или производительности приложений?</summary>

Нет. Moore's law — про **плотность интеграции** (число транзисторов), а не про clock speed и не про application performance.

</details>

<details>
<summary><b>Q:</b> Thought experiment: цикл <code>z[i]=x[i]+y[i]</code> на $10^{12}$ итераций за 1 с. Каково допустимое среднее расстояние до ячейки памяти?</summary>

$3\cdot10^{12}$ обращений к памяти; сигнал идёт со скоростью света:
$$r = \frac{3\cdot10^8 \cdot 1}{3\cdot10^{12}} = 10^{-4}\,\text{м}$$

</details>

<details>
<summary><b>Q:</b> Продолжение thought experiment: какой получается размер ячейки памяти и какой вывод?</summary>

Ребро ячейки $\approx \frac{2\cdot10^{-4}}{\sqrt{3\cdot10^{12}}} \approx 10^{-10}$ м — размер атома. Вывод: последовательный процессор так не ускорить; power, memory и communication constraints — главные причины перехода к параллельным вычислениям.

</details>

<details>
<summary><b>Q:</b> Сколько байт памяти перемещает одна итерация <code>z[i]=x[i]+y[i]</code> в FP64 и сколько всего для $10^{12}$ итераций?</summary>

2 load + 1 store по 8 байт = **24 байта** на итерацию → ~**24 TB** memory traffic за $10^{12}$ итераций.

</details>

<details>
<summary><b>Q:</b> Приведите пример concurrency и parallelism на многополосном перекрёстке.</summary>

- Parallelism: машины на разных полосах в одном направлении едут одновременно.
- Concurrency: светофор по очереди пропускает конфликтующие потоки через общий ресурс (перекрёсток), и все потоки делают прогресс в перекрывающиеся периоды.

</details>
