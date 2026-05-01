# Notes

## Intervals

1. arcs - all, closed-only, no-left, no-right, none.
2. points - hallow, filled, tick.
3. regions - hatched, not hatched.
4. above - region labels.
5. below - up down arrows.
6. left labels - above, below.
7. axis arrow and label.

TODO:

- mark the min
- individual points on line
- overlapping intervals

## Unit circle

1. Template
2. Rotable - enum/rad/deg, label, point (hallow, fill, none; label)

TODO:

- spiral rotation

## Functions

1. Axes - from,to. (default suggestion - [-3;3])
2. Grid - yes,no; Small - yes,no
3. Ticks - all,listed(label).
4. Point - filled,hollow,nothing;label;dotted-line-to-axis-x;dotted-line-to-axis-y
5. graph - xfromto;yfromto;TYPE;transform(f(x) form)
6. area - bucket fill with one point coords; label in center.

TYPE:

- line (y=kx+b (with a/b fractions); 2 points; x=a)
- parabola (abc;amn;axx) - `graph parabola y=ax^2+bx+c`, `y=a(x-x_1)(x-x_2)`, `y=a(x-m)^2+n`, `(x;y) (x_2;y_2) (x_3; y_3)`
- hyperbola (k=sth) for y=k/x
- cubic (can give 4 points), sqrt, cbrt
- log, exp (a=2 or a=1/2 or a=0.5), default a=2
- circle (x,y,r) - (0;0) r=3
- sin,cos,tg,ctg or tan cot - scaled so 1 means pi/2
- generic[smooth] - cubic bezier (verteces and passing points)

`graph generic[smooth] (2;0) v(3;2) v(4;4)`

xfromto, yfromto: nothing, x[2;3], x[2;], x[;2]

transform:

```
  >>f(x)+a
  >>f(x+a)
  >>-f(x)
  >>af(x)
  >>f(-x)
  >>f(ax)
  >>|f(x)|
```

```
  Parabola — exactly one of:
  - graph parabola y=ax^2+bx+c — e.g. y=2x^2-3x+1
  - graph parabola y=a(x-m)^2+n — e.g. y=-(x+2)^2+5
  - graph parabola y=a(x-r1)(x-r2) — e.g. y=2(x-1)(x+3)
  - graph parabola (x1;y1) (x2;y2) (x3;y3) — 3 points
  - graph parabola alone - draws x^2

  Cubic — exactly one of:
  - graph cubic y=ax^3+bx^2+cx+d — e.g. y=x^3-2x^2+x
  - graph cubic (x1;y1) (x2;y2) (x3;y3) (x4;y4) — 4 points
  - graph cubic alone — draws x^3
```

`angle right (x1;y1) (x2;y2) (x3;y3) label`

WIP...

TODO:

- small graph dots not scale. DONE
- parabola with 3 points. DONE
- angles. DONE
- scale axes. DONE
- medium scale; make tick labels a bit smaller... for medium and for small. DONE
- f(x-1) transformation DONE
- naming axes DONE
- make medium scale the default - rn it's too big. DONE
- generic line can go not like function DONE

TODO:

- fix area render fails
- allow to label point from any dir.
- `function: graph cubic (-0.5;0) (0;1) (2;0) (5;0)`
