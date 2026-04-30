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

TODO:

1. Axes - from,to. (default suggestion - [-3;3])
2. Grid - yes,no; Small - yes,no
3. Ticks - all,listed(label).
4. Point - filled,hollow,nothing;label;dotted-line-to-axis-x;dotted-line-to-axis-y
5. graph - xfromto;yfromto;TYPE;transform(f(x) form)
6. area - bucket fill with one point coords; label in center.

TYPE:

- line (y=kx+b (with a/b fractions); 2 points; x=a)
- parabola (abc;amn;axx) - `graph parabola a=1 b=2 c=4`, `a=1 x{1;3}`, `a=1 v(1;3)`.
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

WIP...

TODO:

- angles.
