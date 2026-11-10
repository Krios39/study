# Карточки — Лекция 05: The Shady Side of Parallel Computing (An Introduction to Shaders)

> На слайдах лекции в основном вопросы для обсуждения и лабораторные задания. Ответы про GLSL/Godot взяты из общих знаний о том, что разбиралось на занятии (The Book of Shaders, Godot).

<details>
<summary><b>Q:</b> What is a shader?</summary>

Небольшая программа, которая выполняется на **GPU** как часть graphics pipeline. Пишется на GLSL / HLSL / Godot Shading Language.

</details>

<details>
<summary><b>Q:</b> Vertex shader vs fragment shader?</summary>

- **Vertex shader** запускается для каждой **вершины** и считает её позицию и трансформацию.
- **Fragment (pixel) shader** запускается для каждого **пикселя** и считает его **цвет**.

The Book of Shaders работает с fragment shaders.

</details>

<details>
<summary><b>Q:</b> Why is a fragment shader an example of parallel computing?</summary>

Один и тот же код выполняется **одновременно для каждого пикселя** (data parallelism / SIMD). Каждый экземпляр независим: он знает только свою координату и общие `uniform`-значения. По сути это kernel над 2D-сеткой.

</details>

<details>
<summary><b>Q:</b> What was the point of the GPU video (CPU vs GPU painting demo) and why is it significant for parallel computing?</summary>

- CPU рисует картинку **последовательно**, точку за точкой (мало мощных ядер).
- GPU рисует **всю картинку сразу** множеством простых исполнителей.
- Вывод: GPU выгоден, когда одну простую операцию нужно применить к огромному числу независимых элементов (massive data parallelism).

</details>

<details>
<summary><b>Q:</b> What type of parallel problems suit a GPU, and what are the issues?</summary>

**Подходят:** data-parallel / embarrassingly parallel задачи, где каждый элемент считается независимо (пиксели, изображения, матрицы, симуляции частиц).

**Проблемы:**
- зависимости между элементами;
- ветвления (divergence);
- обмен данными между потоками;
- накладные расходы на пересылку CPU↔GPU;
- сложная отладка.

</details>

<details>
<summary><b>Q:</b> Why could people "hate" programming in shader style?</summary>

- Нет общего изменяемого состояния: пиксель не видит результат соседей и не может в него писать.
- Всё нужно выражать как **функцию от координаты**, математически.
- Нет `printf`: отлаживают выводом цвета.
- `if`/ветвления дороги, проблемы с точностью float.
- Мышление «одна программа на пиксель» непривычно.

</details>

<details>
<summary><b>Q:</b> What is a `uniform` in GLSL?</summary>

Входное значение, **одинаковое для всех** экземпляров шейдера (всех пикселей) в одном draw call. Его задаёт CPU. Примеры: `u_time`, `u_resolution`, `u_mouse`. Аналог аргумента kernel или constant memory в OpenCL.

</details>

<details>
<summary><b>Q:</b> What do `gl_FragCoord` and `gl_FragColor` mean?</summary>

- `gl_FragCoord`: координата **текущего пикселя** в пикселях (у каждого экземпляра своя, аналог `get_global_id`).
- `gl_FragColor`: выходной RGBA-**цвет** пикселя (`vec4`).

</details>

<details>
<summary><b>Q:</b> What does this fragment shader draw?

```glsl
uniform vec2 u_resolution;
void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    gl_FragColor = vec4(st.x, st.y, 0.0, 1.0);
}
```
</summary>

Градиент: `st` — нормализованная координата в [0,1].
- Красный растёт слева направо (`st.x`), зелёный снизу вверх (`st.y`).
- Левый нижний угол чёрный, правый нижний красный, левый верхний зелёный, правый верхний жёлтый.

</details>

<details>
<summary><b>Q:</b> What does `step(edge, x)` return, and how is it used to draw a rectangle?</summary>

`step(edge, x) = 0.0`, если `x < edge`, иначе `1.0`.

Прямоугольник — это произведение четырёх step-функций (левая, нижняя, правая, верхняя граница):
```glsl
vec2 bl = step(pos, st);
vec2 tr = step(1.0 - pos - size, 1.0 - st);
float inside = bl.x * bl.y * tr.x * tr.y;  // 1 внутри, 0 снаружи
```

</details>

<details>
<summary><b>Q:</b> What was the lab task based on The Book of Shaders Chapter 7?</summary>

Написать функцию, которая двигает и размещает несколько **прямоугольников** на одном billboard, и собрать из прямоугольников и цветов композицию в стиле **Piet Mondrian**. Сдать shader code + textures.

</details>

<details>
<summary><b>Q:</b> What was the second lab task?</summary>

Взять шейдер средней сложности с **Shadertoy** и **портировать его в Godot** (сдать shader code + textures).

</details>

<details>
<summary><b>Q:</b> Porting from Shadertoy to Godot: how do the main names map?</summary>

| Shadertoy | Godot 4 |
|---|---|
| `mainImage(out vec4 fragColor, in vec2 fragCoord)` | `void fragment()` |
| `iTime` | `TIME` |
| `fragCoord / iResolution.xy` | `UV` (или `SCREEN_UV`) |
| `fragColor = ...` | `COLOR = ...` |

Плюс в начале файла нужен `shader_type canvas_item;` (2D) или `spatial` (3D).

</details>

<details>
<summary><b>Q:</b> Map shader concepts to GPGPU (OpenCL/CUDA) concepts.</summary>

- pixel / fragment ↔ work-item / thread
- `gl_FragCoord` / `UV` ↔ `get_global_id()`
- `uniform` ↔ kernel argument / constant memory
- output image ↔ output buffer
- fragment shader ↔ kernel, который запускается над NDRange размером с картинку

</details>

<details>
<summary><b>Q:</b> How do you run the backup version of the lecture material locally?</summary>

```bash
git clone --recursive https://github.com/ulno/ShaderTeaching
python3 -m http.server
# открыть http://localhost:8000/sample.html
```

</details>

<details>
<summary><b>Q:</b> Which tools/environments were used in the shader lecture?</summary>

- **The Book of Shaders** (thebookofshaders.com): GLSL fragment shaders в браузере (WebGL).
- **Godot 4**: game engine со своим shading language.
- **Shadertoy**: галерея шейдеров, источник для портирования.

</details>
