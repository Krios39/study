# Лекция 07: Introduction to C++

Слайды: нет (live demo); код: code\cpp1, code\cpp2, code\cpp3

Конспект составлен **только по примерам кода** из демо.

## Базовая программа (cpp1/hello.cpp)
```cpp
#include <iostream>   // ввод/вывод
#include <cstdlib>    // EXIT_SUCCESS / EXIT_FAILURE
using namespace std;  // иначе std::cout, std::string
int main() {
    string x = "...";
    cout << "Hello, world!" << x << endl;
    return EXIT_SUCCESS;
}
```
- Компилируется в нативный код (в отличие от Java bytecode/JVM), напр. `g++ hello.cpp -o hello`.
- `cout <<` — вывод, `cerr <<` — поток ошибок, `endl` — перевод строки + flush.

## Header и source (cpp1/functions.h, functions.cpp)
- `.h` — **объявление** (declaration): `long minimum(long a, long b);`
- `.cpp` — **тело** (definition). `#include "functions.h"` — свои заголовки в кавычках, системные в `<>`.
- Функция должна быть **объявлена до использования**.
- В params.cpp `minimum` определена прямо в файле и внутри делает `a = 6;` — параметры передаются **по значению**, изменение копии не влияет на вызывающего.

## Аргументы командной строки (cpp1/params.cpp)
```cpp
int main(int argc, char *argv[]) {
    if (argc != 4) { cerr << "Error: ..." << endl; return EXIT_FAILURE; }
    long a = atol(argv[1]);                        // текст → число
    if (strcmp(argv[3], "minimum") == 0) ...       // сравнение C-строк (<cstring>)
}
```
- `argv[0]` — имя программы ⇒ 3 пользовательских аргумента дают `argc == 4`.

## Классы, указатели, new/delete (cpp2/demo4.cpp)
```cpp
class Rectangle {
  private: int x; int privatemethod() { return x; }
  public:  int width, height;
           int surface() { return width * height; }
};                                   // ; после класса обязательна
Rectangle rect1;                     // объект на стеке (без new)
rect1.width = 5;
Rectangle* rect3 = new Rectangle();  // объект в heap, указатель
rect3->width = 3;                    // -> для доступа через указатель
int* p = &rect1.width;  *p;          // & — адрес, * — разыменование
delete rect3;                        // ручное освобождение памяти (нет GC)
rect3 = new Rectangle();             // снова new...
int* p2 = new int;                   // ...и не освобождено ⇒ memory leak
```
- Модификаторы доступа — секциями `private:` / `public:`.
- Объекты могут жить **на стеке** (автоматически уничтожаются) или **в heap** через `new` (нужен `delete`).

## Указатели vs ссылки (cpp3/functions.cpp)
```cpp
void change(int* y) { *y = 6; }      // через указатель
void swap(int &x, int &y) { int t = x; x = y; y = t; }   // по ссылке
int* x = new int; *x = 5; change(x); // *x == 6
int a = 6, b = 7; swap(a, b);        // печатает "76"
```
- Передача **по значению** (копия), **по указателю** (`int*`, надо `*` для доступа), **по ссылке** (`int&`, синтаксис как у обычной переменной, меняет оригинал).

## Templates (cpp3/demo1.cpp, demo3.cpp)
```cpp
template <typename T>
T getMin(T a, T b) { return (a < b) ? a : b; }
getMin(5, 3);                         // T = int, выводится компилятором
getMin(string("a"), string("b"));     // T = string

template <class T>
class Line {
public:
    T p1, p2;
    Line() = default;
    Line(T np1, T np2) : p1(np1), p2(np2) {}   // member initializer list
    float length() { return p1.distanceFrom(p2); }   // T обязан иметь distanceFrom
};
```
- Шаблоны — generic-код, инстанцируется на этапе компиляции для конкретного типа; требования к T проверяются при инстанцировании ("duck typing" на компиляции).

## STL-контейнеры (cpp3/demo2.cpp, demo4.cpp)
```cpp
vector<string> v; v.push_back(la); string s = v[0];
stack<int> st; st.push(7); int top = st.top();
vector<float> c; c.push_back(1.7);
for (float k : c) cout << k;                 // range-based for (C++11)
auto it = c.begin();                          // auto — вывод типа
while (it != c.end()) { float k = *it; it++; }   // итераторы
```

## Отличия от Java (по примерам)
- Нет JVM, нет garbage collector — `new`/`delete` вручную; указатели есть (в Java — нет).
- Объекты могут быть значениями на стеке; в Java объекты всегда в heap через ссылки.
- Header/source разделение; templates вместо generics.
