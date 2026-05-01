# Docs

Updated: 2026-05-01

> **Tip**: if lazy to read, analyze, learn - just drop the pure command javascript file to some LLM and ask what you want, it will format for you.

Commands:

- [function](./commands/function.js) - DONE, has issues,
- [interval-arcs](./commands/interval-arcs.js) - almost done,
- [unit-circle](./commands/unit-circle.js) - started,
- cuboid - not started,
- circle - not started,
- cone - not started,
- cylinder - not started,
- parallelogram - not started,
- quadritelateral-pyramid - not started,
- triangle - not started,
- triangle-pyramid - not started.

## `function`

Start with `function` and then add components.

### Size

`function[small]: ...`

`function[medium]: ...` or just `function: ...`

`function[large]: ...`

### Grid

`function[grid]: ...`

With size - size first: `function[small][grid]: ...`

### Axes

This and other components go after the `function:` part, indicated by keyword, can be separated by any whitespaces.

```
function:
axes Ox [-2;3] {1=A; 2=x_B} x2 Ox [-2;3] {all} x0.5
```

- `Ox` and `Oy` indicates the axis.
- `[start;end]` indicates approximate start/end of axes. If not mentioned - defaults to `[-3;3]`.
- `{-1;0;1}` or `{all}` or `{-1=A; 0=B; 1=C}` indicates the ticks to show on the axis, `=` assigns different label. If not mentioned - defaults to `{}`.
- `x2` or `x0.5` indicates the axis scaling. If not mentioned - defaults to `x1`.

### Graph

```
function:
axes Ox [-3;3] {all} Oy [-1;4] {all}
graph line y=2x+1/2
graph line (-1;2) (2;3)
graph parabola y=-x^2+3x+2
graph hyperbola k=-3 x[-1;] >>f(x-1) >>f(x)+3
graph generic smooth (1;0) ^(2;7) v(3;-1) (4;0)
```

`graph` + `<type>` + `<specification>` + `<x and y ranges>` + `<transformations>`

Types:

- line: `y=kx+b` or `x=a` or `(x_1; y_1) (x_2; y_2)`.
- parabola: `y=ax^2+bx+c` or `y=a(x-r1)(x-r2)` or `y=a(x-m)^2+n` or `(x_1; y_1) (x_2; y_2) (x_3; y_3)`. If not mentioned - defaults to `y=x^2`.
- cubic: `y=ax^3+bx^2+cx+d` or `(x_1; y_1) (x_2; y_2) (x_3; y_3) (x_4; y_4)` (has issues).
- hyperbola: `k=a`
- sqrt, cbrt.
- exp, log: `a=2` or `a=1/2` or `a=0.5` and no other. Default - `a=2`.
- sin, cos, tg, ctg. OX axis scaled by pi/2. That means that 1 means pi/2, 2 means pi etc.
- circle: `(x; y) r=a`
- generic smooth: through what points going, `v(x;y)` means "bottom" vertex, `^(x;y)` means "top" vertex, `(x;y)` means not a vertex.
- generic: `(x;y) (x;y) ...` or `y=abs(sin(x^5))...` (free form).

Ranges:

- `x[from;to]`
- `y[from;to]`

Transformations:

```
  >>f(x)+a
  >>f(x+a)
  >>-f(x)
  >>af(x)
  >>f(-x)
  >>f(ax)
  >>|f(x)|
```

### Point

Has issues - sometimes overlaping with other elements.

```
function:
graph parabola x[-1;1]
point (-1;1) [A]
point (1;1) (B)
point (0;0) ()
point (2;1) C x-line y-line
```

- `[label]` means filled
- `(label)` means hollow
- `label` means just a label
- `x-line` - to the x axis
- `y-line` - to the y axis

### Area

Many issues!

```
function:
axes Ox[-3;6] Oy[-3;4]
point (0;0) O
point (0;3) [3]
point (3;0) [3]
graph circle r=3
graph parabola y=1/3(x-3)^2
area (2;1) S_1
```

Bucket fill for area, optional label in the center.

### Angle

Has issues - small and overlaping with other elements.

```
function[large]:
graph line y=-x+2
angle (0;2) (2;0) (3;0) 135^\circ
```

Tree points as in `$\angle ABC$` notation + optional label.

### Examples

```
function[large]:
axes Oy[-1;4]{0;1;3} Ox[-1;5]{0;2;4}
graph parabola (0;0) (2;3) (4;4)
graph parabola (-1;4) (2;3) (4;1)
graph line (0;0) (4;1)
point (0;2.3) _{y=f(x)}
point (2.5;2.5) _{y=g(x)}
point (3.8;1.2) _{y=h(x)}
point (2;3) []
point (4;1) []
area (2;1)
```

![alt text](image.png)

```
function[large]:
axes Ox[-1;4]{0;1} Oy[-1;4]{1;2}
point (0;2) []
point (0;0) []
graph sqrt >>f(x)+2
```

![alt text](image-1.png)

```
function:
axes Oy[-0.8;0.8]{-1;0;1} x2 Ox[-0.5;2]{1/3=30^\circ; 1=90^\circ; 5/3=150^\circ; 2=180^\circ} x3
graph sin
graph line y=0.5
point (0.3333;0.5) [] x-line
point (1.6666;0.5) [] x-line
```

![alt text](image-2.png)

## `interval-arcs`

In progress...

### Examples

```
interval-arcs: _-_ (0) =+= (4) _-_ >x
```

![alt text](image-3.png)

```
interval-arcs[closed-only]: ^{S'(a)}_{S(a)} __ (0) _+_up |1\frac13| _-_down (4) __ >a
```

![alt text](image-4.png)
