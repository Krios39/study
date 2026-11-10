# Карточки — Лекция 03: Introduction to Java

<details>
<summary><b>Q:</b> Какие инновационные черты были у Java при создании?</summary>

- Virtual machine — "write once, run everywhere".
- Объектно-ориентированный дизайн с нуля.
- Встроенная безопасность (нет указателей и т.д.).

</details>

<details>
<summary><b>Q:</b> В чём Java консервативна?</summary>

C-style синтаксис, императивна внутри объектов, в основном последовательная; функциональные возможности добавлены в новых версиях.

</details>

<details>
<summary><b>Q:</b> Есть ли в Java поддержка параллельного программирования и как она развивалась?</summary>

Есть с самого начала (Thread), расширялась в новых версиях: напр. ExecutorService (Java 5), **fork/join в Java 7**, streams/CompletableFuture (Java 8).

</details>

<details>
<summary><b>Q:</b> JVM vs JDK?</summary>

JDK — набор разработчика (компилятор `javac` и т.д.), компилирует исходники в bytecode. JVM — виртуальная машина, исполняющая bytecode (на любой платформе).

</details>

<details>
<summary><b>Q:</b> Что напечатает: `char ch='c'; int a=0; System.out.println("Result is "+(ch+a));`</summary>

`Result is 99` — в скобках char + int даёт числовое сложение (код 'c' = 99), затем конкатенация со строкой.

</details>

<details>
<summary><b>Q:</b> `Car car3 = null; if (a > 0) car3 = car1; car3.accelarate(6);` — что может пойти не так?</summary>

Если `a <= 0`, car3 остаётся null ⇒ **NullPointerException**. Если a > 0, car3 и car1 — ссылки на **один и тот же** объект: изменение через car3 видно через car1.

</details>

<details>
<summary><b>Q:</b> `Vehicle x = new Car(); x.isPowered();` — чья версия метода вызовется?</summary>

Версия **Car** (override, dynamic dispatch) — polymorphism: тип ссылки Vehicle, фактический объект Car ⇒ вернёт true.

</details>

<details>
<summary><b>Q:</b> Чем interface отличается от class (по примеру VehicleInterface)?</summary>

Interface только объявляет методы (`boolean isPowered();`), без реализации и состояния; класс подключает его через `implements` (можно несколько), а наследует класс через `extends` (только один).

</details>

<details>
<summary><b>Q:</b> Зачем делать поля private и давать getters/setters?</summary>

Encapsulation: доступ к состоянию только через методы, класс контролирует изменения (напр. Car.accelarate проверяет значение < 200).

</details>

<details>
<summary><b>Q:</b> Где в Java хранятся объекты и что хранят переменные типа класса?</summary>

Объекты — в heap (создаются через `new`), переменные хранят **ссылки** на них. Это важно для многопоточности: любой поток со ссылкой может обратиться к объекту.

</details>
