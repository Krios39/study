# Лекция 05: The Shady Side of Parallel Computing (An Introduction to Shaders)

Слайды: parcomp-slides-shaders.pdf

Гостевая лекция Ulrich Norbisrath. Слайды почти полностью интерактивные: видео, обсуждение, live-coding в The Book of Shaders и Godot 4, лабораторные задания. Фактического материала на самих слайдах мало. Раздел «Что стоит знать» ниже — это короткие пояснения из общих знаний о том, что разбиралось на занятии (The Book of Shaders, Godot shading language). Он помечен отдельно, чтобы не путать его с текстом слайдов.

---

## 1. Что есть на слайдах

### A Word on GPUs: видео и обсуждение
- Видео (YouTube short). Вопросы к нему: *What is the point of the movie? Why is this significant for parallel computing?*
  - Скорее всего, это известная демонстрация «CPU vs GPU» (MythBusters для NVIDIA): один робот рисует картинку по точке, последовательно (CPU), а другой «выстреливает» всю картинку разом из тысяч трубок (GPU). Мысль простая: GPU выполняет **одну и ту же простую операцию над огромным числом элементов одновременно**.
- Вопрос для обсуждения: *What type of parallel problems can be solved on a GPU, and what might be the issues?*
  - Подходят **data-parallel / embarrassingly parallel** задачи: каждый пиксель или элемент обрабатывается независимо (графика, обработка изображений, матрицы, симуляции).
  - Проблемы: ветвления (divergence), зависимости между элементами, обмен данными между потоками, пересылка данных CPU↔GPU, отладка.

### Get Ready (запасной вариант, если сайт не работает)
```bash
git clone --recursive https://github.com/ulno/ShaderTeaching
python3 -m http.server          # в этой папке
# открыть http://localhost:8000/sample.html
```

### Let the experiment begin
- Следовать за лектором по **https://thebookofshaders.com**.
- Вопросы к финальному обсуждению: *What works well? What could be problematic programming in such a way (why could people hate it)?*

### In a game engine: Godot
- Распаковать Godot 4, запустить, создать проект, повторять за лектором.

### Getting Advanced
- Обзор: Furcifer's Godot intro (видео). Вопросы: какая новая возможность самая интересная, что было самым страшным или сложным.

### Lab Tasks
1. Решить **"Book of Shaders" Chapter 7** (Shapes): написать функцию, которая двигает и размещает разные прямоугольники на одном billboard, и собрать композицию в стиле **Piet Mondrian** (сдать shader code + textures).
2. Взять «medium»-шейдер с **Shadertoy** и **портировать в Godot** (сдать shader code + textures).

### End Discussion
- *How can we take this to parallel computing? What is cool/exciting about shaders? What is hard/difficult?*

---

## 2. Что стоит знать о шейдерах (пояснения из общих знаний)

### Что такое shader
- **Shader** — маленькая программа, которая выполняется на **GPU** внутри графического конвейера (graphics pipeline).
- Основные виды:
  - **Vertex shader** — выполняется для каждой вершины и вычисляет её позицию.
  - **Fragment (pixel) shader** — выполняется для **каждого пикселя (fragment)** и вычисляет его **цвет**. The Book of Shaders посвящена в основном fragment shaders.
  - **Compute shader** — вычисления общего назначения внутри графического API (см. OpenCL-лекции: compute shader в OpenGL является частью 3D graphics pipeline, а OpenCL kernel — нет).
- Языки: **GLSL** (OpenGL/WebGL, The Book of Shaders), HLSL (DirectX), **Godot Shading Language** (похож на GLSL).

### Почему это параллельное программирование
- Один и тот же код запускается **одновременно для каждого пикселя**: это модель **SIMD / data parallelism**, по сути «kernel» над 2D-сеткой пикселей.
- Каждый экземпляр (пиксель) **не знает, что посчитали соседи**, и не может записать в соседний пиксель. Вход у него только один: его координата + общие `uniform`-значения.
- Отсюда «why people hate it»: нет общего состояния и памяти между пикселями, всё приходится выражать как **функцию от координаты** (математически, без циклов по картинке), неудобная отладка (нет `printf`, отлаживают цветом), ветвления (`if`) дороги, нужна точность float.

### Ключевые понятия из The Book of Shaders (GLSL)
```glsl
#ifdef GL_ES
precision mediump float;
#endif
uniform vec2  u_resolution;  // размер холста в пикселях
uniform vec2  u_mouse;       // позиция мыши
uniform float u_time;        // время в секундах

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;   // нормализуем координату пикселя в [0,1]
    vec3 color = vec3(st.x, st.y, abs(sin(u_time)));
    gl_FragColor = vec4(color, 1.0);             // выходной цвет пикселя (RGBA)
}
```
- **`uniform`** — значение, одинаковое для всех пикселей (передаётся с CPU): time, resolution, mouse.
- **`gl_FragCoord`** — координата текущего пикселя (у каждого экземпляра своя, аналог `get_global_id`).
- **`gl_FragColor`** — результат (цвет пикселя).
- Типы: `float`, `vec2/vec3/vec4`, swizzling (`color.rgb`, `st.xy`).
- Shaping functions: `step(edge, x)`, `smoothstep(a, b, x)`, `mix`, `fract`, `sin`, `abs`, `clamp`, `length`, `distance`.
- **Chapter 7 (Shapes)**: прямоугольник через `step`:
  ```glsl
  float rect(vec2 st, vec2 pos, vec2 size) {
      vec2 bl = step(pos, st);                  // left/bottom borders
      vec2 tr = step(1.0 - pos - size, 1.0 - st); // right/top borders
      return bl.x * bl.y * tr.x * tr.y;          // 1 внутри, 0 снаружи
  }
  ```
  Комбинируя несколько `rect` и цвета, получают картину в стиле Mondrian.

### Godot 4 shaders (кратко)
```glsl
shader_type canvas_item;   // 2D (spatial — для 3D)
uniform vec4 tint : source_color;
void fragment() {
    COLOR = vec4(UV, abs(sin(TIME)), 1.0);
}
```
- Встроенные переменные: `UV` (координата 0..1), `TIME`, `COLOR`, `TEXTURE`, `SCREEN_UV`. Функции-точки входа: `vertex()`, `fragment()`, `light()`.
- При портировании с Shadertoy: `mainImage(out vec4 fragColor, in vec2 fragCoord)` → `fragment()`, `iTime` → `TIME`, `fragCoord/iResolution.xy` → `UV`, `fragColor` → `COLOR`.

### Связь с параллельными вычислениями (вывод)
| Shader-мир | GPGPU (OpenCL/CUDA) |
|---|---|
| пиксель / fragment | work-item / thread |
| `gl_FragCoord` / `UV` | `get_global_id()` |
| `uniform` | аргумент kernel / constant memory |
| картинка-результат | выходной buffer |
| нет связи между пикселями | независимые work-items (синхронизация только внутри work-group) |

GPGPU возник именно отсюда: сначала вычисления «маскировали» под рендеринг текстур шейдерами, а потом появились CUDA/OpenCL (лекция 08).
