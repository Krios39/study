# Лекция 03: Introduction to Java

Слайды: session3.pdf; код: code\session3lecturecode\javaintro\src\ (Car, Vehicle, Pushbike, VehicleInterface, MyFirstClass, Exerxise2)

Лекция в основном live demo; слайдов 4.

## Слайды

- Java — популярный многоцелевой язык: коммерция, наука, обучение; desktop, server, embedded, (исторически) applets.
- Инновации при создании: **virtual machine** ("write once, run everywhere"), **объектно-ориентированный дизайн с нуля**, встроенная **безопасность** (нет указателей и т.д.).
- Консервативен: C-style синтаксис, императивный внутри объектов, в основном последовательный; новые версии расширили **функциональные** возможности.
- Поддержка параллельного программирования есть с самого начала и расширялась (например, **fork/join в Java 7**).
- Темы демо: JVM и JDK; переменные, типы, операторы, управляющие конструкции; классы и объекты; методы, конструкторы, атрибуты; типы, casting, polymorphism; полезные классы стандартной библиотеки.

## По коду

- **JVM/JDK**: `javac` компилирует в bytecode, `java` запускает на JVM.
- Точка входа: `public static void main(String[] args)`.
- Примитивы: `int, float, double, boolean, char`; `char` неявно приводится к `int` (`int a2 = 'd';`). `String` — объект; `"Result is " + (ch + a)` — сначала числовое сложение в скобках.
- Массивы: `int[] f = new int[5];` (инициализированы нулями), `int[] arr = {1,2,3};`, `arr.length`. Циклы: `for (int i...)`, enhanced for `for (int x : arr)`, `while`.
- Коллекции: `List<String> list = new ArrayList<>(); list.add(...)` (raw `List` без generics — компилируется, но с warning).
- Классы: `private` поля + public getters/setters (encapsulation), `this.field`.
- **Наследование**: `class Car extends Vehicle`, `class Pushbike extends Vehicle` (пустой — всё наследует). Car **переопределяет** `isPowered()` (override) — polymorphism: `Vehicle x = new Car(); x.isPowered()` вызовет версию Car.
- **Interface**: `interface VehicleInterface { boolean isPowered(); }` — только объявление; класс реализует через `implements`.
- Ссылки: `Car car3 = null; if (a>0) car3 = car1;` — car3 и car1 указывают на **один объект**; если бы условие было ложно — `car3.accelarate(6)` ⇒ **NullPointerException**. Объекты в heap, переменные хранят ссылки (важно для лекции 04).
- `car1` и `car2` — разные объекты с собственным состоянием (`speed`). В MyFirstClass `a` = 7 после while, car3 = car1, потом `accelarate(6)` и `accelarate(4)` на одном объекте ⇒ печатается `10  0`.
- Статические методы библиотеки: `Math.abs(-6)`.
