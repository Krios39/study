# Карточки — Лекция 07: Introduction to C++

<details>
<summary><b>Q:</b> Зачем разделять код на .h и .cpp?</summary>

`.h` — **объявление** функции (`long minimum(long a, long b);`), `.cpp` — её тело (definition). Заголовок подключается `#include "functions.h"`; функция должна быть объявлена до использования.

</details>

<details>
<summary><b>Q:</b> `#include <iostream>` vs `#include "functions.h"`?</summary>

`<...>` — системные/стандартные заголовки; `"..."` — свои файлы проекта.

</details>

<details>
<summary><b>Q:</b> Программа ожидает 3 аргумента командной строки. Какое значение argc проверять?</summary>

`argc == 4` — `argv[0]` содержит имя программы. Числа из текста: `atol(argv[1])`; сравнение C-строк: `strcmp(a, b) == 0`.

</details>

<details>
<summary><b>Q:</b> Внутри `long minimum(long a, long b)` написано `a = 6;`. Изменится ли переменная вызывающего?</summary>

Нет — параметры передаются **по значению** (копия). Но результат функции будет считаться уже с a = 6.

</details>

<details>
<summary><b>Q:</b> `Rectangle r;` vs `Rectangle* r = new Rectangle();` — разница?</summary>

- Первое — объект на **стеке**, уничтожается автоматически при выходе из области видимости; доступ через `.`.
- Второе — объект в **heap**, указатель; доступ через `->`; нужно вручную `delete r;`.

</details>

<details>
<summary><b>Q:</b> Что не так в конце demo4.cpp: `rect3 = new Rectangle(); int* p2 = new int; return EXIT_SUCCESS;`?</summary>

Память, выделенная `new`, не освобождается `delete` ⇒ **memory leak** (в C++ нет garbage collector).

</details>

<details>
<summary><b>Q:</b> Что делают операторы `&` и `*` в `int* p = &rect1.width; cout << *p;`?</summary>

`&` берёт адрес переменной, `*` разыменовывает указатель (читает значение по адресу) ⇒ печатает 5.

</details>

<details>
<summary><b>Q:</b> Указатель vs ссылка при передаче в функцию (`change(int* y)` vs `swap(int &x, int &y)`)?</summary>

Оба позволяют менять оригинал. Указатель: передаётся адрес, внутри нужно `*y = 6`, может быть null. Ссылка: синтаксис как у обычной переменной, псевдоним оригинала. `int a=6,b=7; swap(a,b);` ⇒ печатает `76`.

</details>

<details>
<summary><b>Q:</b> Что такое template в C++? Пример.</summary>

Обобщённый код, инстанцируемый компилятором для конкретного типа:
```cpp
template <typename T> T getMin(T a, T b) { return (a < b) ? a : b; }
getMin(5, 3);          // int
getMin(sa, sb);        // string
```
Требования к T (напр. `operator<`, `distanceFrom` в `Line<T>`) проверяются при инстанцировании.

</details>

<details>
<summary><b>Q:</b> Какие STL-контейнеры и способы обхода использовались в примерах?</summary>

`vector<T>` (`push_back`, `v[0]`), `stack<T>` (`push`, `top`). Обход: range-based for `for (float k : v)` (C++11) и итераторы `auto it = v.begin(); while (it != v.end()) { *it; it++; }`.

</details>

<details>
<summary><b>Q:</b> Главные отличия C++ от Java по примерам демо?</summary>

Компиляция в нативный код (нет JVM); нет garbage collector — `new/delete` вручную; есть указатели; объекты могут быть значениями на стеке; header/source; templates вместо generics.

</details>
