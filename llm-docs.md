# Matikzy — LLM Reference

Matikzy generates LaTeX/TikZ diagrams from a short DSL. Commands: `function`, `geometry`, `interval`, `unit-circle`.

Comments: use `//` to add a comment (to end of line).

---

## `function` — coordinate plane graphs

### Prefix (size / grid)
```
function:           (default, medium)
function[small]:
function[large]:
function[grid]:     (adds grid; combine: function[small][grid]:)
```

### axes
```
axes Ox[-2;3]{all} x2 Oy[-1;4]{0;1;3} x1
axes Ox[-1;5]{0;2;4} Oy[-2;2]{1;2} Ox=t
```
- `Ox` / `Oy` — which axis
- `[-2;3]` — approximate display range (default `[-3;3]`)
- `{all}` — show all integer ticks; `{1;2;3}` — listed; `{1=A; 2=x_B}` — custom labels; `{}` or omit — no ticks
- `x2` / `x0.5` — scale factor (default `x1`)
- `Ox=t` — puts label `t` on the axis end
- If 0 is not in the range, that axis is not drawn

### graph
```
graph line y=2x+1/2
graph line x=3
graph line (-1;2) (2;3)
graph parabola y=-x^2+3x+2
graph parabola y=-(x+2)^2+5
graph parabola y=2(x-1)(x+3)
graph parabola (0;0) (1;1) (2;4)
graph parabola                          ← draws y=x²
graph cubic y=x^3-2x^2+x
graph cubic (0;0) (1;1) (2;3) (3;4)
graph cubic                             ← draws y=x³
graph hyperbola k=-3
graph sqrt
graph cbrt
graph exp a=2                           ← y=2^x (default a=2)
graph log a=0.5
graph sin                               ← scaled: x=1 means π/2
graph cos
graph tg   (or tan)
graph ctg  (or cot)
graph circle (1;2) r=3
graph generic smooth (1;0) v(3;2) ^(2;7) (4;0)   ← v=bottom vertex, ^=top vertex
graph generic y=abs(sin(x^5))          ← expression, JS syntax (^ is **)
```

**Ranges** (appended to any graph, before transforms or after last transform):
```
graph parabola y=x^2 x[0;3] y[0;5]
graph hyperbola k=1 x[-3;-0.1]
```
One or both bounds may be omitted: `x[2;]`, `x[;3]`.

**Style flag** (append after everything else):
```
graph line y=2x+1    -- dotted
graph hyperbola k=1  -- dashed
graph sqrt           -- solid   (default)
```

**Transformations** (chain with `>>`):
```
graph sqrt >>f(x)+2 >>f(x-1) >>-f(x) >>|f(x)| >>2f(x) >>f(2x) >>f(-x)
graph hyperbola k=1 >>f(x+1) -- dotted
```
Transforms apply in order. A range written after the last `>>` is in post-transform (screen) coordinates.

### point
```
point (2;3) [A]               ← filled dot, label A
point (2;3) (B)               ← hollow dot, label B
point (2;3) C                 ← no dot, just label
point (2;3) []                ← filled, no label
point (0;2) [A] top left x-line y-line
point (2.5;2.5) _{y=g(x)}    ← subscript-style label, no dot
```
- `x-line` / `y-line` — dotted projection to axis
- Position: `top`, `bottom`, `left`, `right`, `top left`, `top right`, `bottom left`, `bottom right`

### area
```
area (2;1) S_1
```
Bucket-fills the enclosed region containing the point. Optional label at center.

### angle
```
angle (0;2) (2;0) (3;0) 135^\circ
angle right (0;1) (0;0) (1;0)
```
Three points as in ∠ABC notation (middle point is the vertex). Optional label. `right` draws a square mark.

### Full example
```
function[large]:
axes Ox[-1;5]{0;2;4} Oy[-1;4]{0;1;3}
graph parabola (0;0) (2;3) (4;4)
graph line (0;0) (4;1)
point (2;3) [A] top left
area (2;1) S
```

```
function:
axes Oy[-0.8;0.8]{-1;0;1} x2 Ox[-0.5;2]{1/3=30^\circ; 1=90^\circ} x3
graph sin
graph line y=0.5 -- dotted
point (0.3333;0.5) [] x-line
```

---

## `geometry` — geometric figures

### Prefix (size)
```
geometry:
geometry[small]:
geometry[large]:
```

Only **one basis** per diagram (triangle, circle, quadrilateral, 3D shape, or parallels). Everything else is drawn on top of existing named points/segments.

---

### Triangle (basis)

**Keyword form:**
```
triangle new ABC                        ← scalene acute (default)
triangle right new A[B]C                ← right angle at B ([] marks special vertex)
triangle obtuse new [A]BC               ← obtuse angle at A
triangle isosceles new A[B]C            ← isosceles, apex at B
triangle equilateral new ABC
triangle right isosceles new A[B]C      ← right+isosceles at B
```
- Angle type: `acute` (default), `right`, `obtuse`
- Side type: `scalene` (default), `isosceles`, `equilateral`
- `[X]` marks the special vertex (right angle / obtuse / isosceles apex)
- Default layout: A=bottom-left, B=top, C=bottom-right

**Congruence form** (specific side/angle values):
```
triangle SSS 3 4 6 new ABC
triangle SAS 3 120 4 new ABC
triangle ASA 120 3 30 new ABC
triangle AAS 120 30 3 new ABC >>rot >>rot120 >>invert
```
Values follow congruence-rule order (sides in units, angles in degrees). Starts from vertex C, goes clockwise.

| Mode | Values (starting at C, clockwise) |
|------|-----------------------------------|
| SSS  | side CA, side AB, side BC |
| SAS  | side CA, angle A, side AB |
| ASA  | angle C, side CA, angle A |
| AAS  | angle C, angle A, side AB |

Rotation / inversion:
- `>>rot` — rotate so the next side is horizontal
- `>>rot120` / `>>rot-240` — rotate by degrees (clockwise)
- `>>invert` — mirror by Y axis

---

### Circle (basis)
```
circle new O-OX          ← center O, X at 0° (rightmost point)
circle new               ← defaults to O-OX
circle 5 new O-OX        ← custom radius 5 (default 2)
```
Format: `center-centerpointOnCircle`. The named point after the dash sits on the circle at 0°.

**Oval (ellipse) transform:**
```
circle new O-OX >>h0.5   ← squish Y axis by 0.5 → oval
circle new >>h0.5         ← no name → defaults to O-OX
```

---

### Quadrilateral (basis)
```
quadrilateral square new ABCD
quadrilateral rectangle new ABCD
quadrilateral parallelogram new ABCD
quadrilateral rhombus new ABCD
quadrilateral trapezoid new ABCD
quadrilateral right trapezoid new ABCD
quadrilateral isosceles trapezoid new ABCD
```
Optional custom dimensions before `new` (defaults shown in DOCS):
```
quadrilateral square 4 new ABCD
quadrilateral rectangle 5.5 3 new ABCD
quadrilateral parallelogram 5 60 3 new ABCD   ← side, angle, side
quadrilateral trapezoid 30 12 60 4 new ABCD
```

Free-form numeric modes (listing starts at vertex D, goes clockwise D→A→B→C):
```
quadrilateral SSSSD 1 2 3 4 2 new ABCD   ← 4 sides + diagonal DB
quadrilateral SSSDD 1 2 3 2 3 new ABCD   ← 3 sides + 2 diagonals
quadrilateral ASASA 90 3 90 3 90 new ABCD
quadrilateral SASAS 3 90 3 90 3 new ABCD
```

| Mode  | Values |
|-------|--------|
| SSSSD | side DA, side AB, side BC, side CD, diagonal DB |
| SSSDD | side DA, side AB, side BC, diagonal DB, diagonal AC |
| ASASA | angle D, side DA, angle A, side AB, angle B |
| SASAS | side DA, angle A, side AB, angle B, side BC |

Vertices: bottom-left → clockwise → ABCD. Supports `>>rot`, `>>rotN`, `>>invert`.

**Suppressing sides:**
```
quadrilateral rectangle new
line AB -- none          ← AB is invisible; points A and B remain usable
line CD -- none
```

---

### 3D basis (cube / cuboid / pyramid / cone / cylinder)
```
cube new ABCDA1B1C1D1
cube 4 new                           ← custom side length (default 4)
cuboid 3x4x5 new                     ← AD × AB × AA1
```

```
pyramid quad 4 4 new SABCD           ← quadrilateral base, base=4, height=4 (default name: SABCD)
pyramid quad right 2 3 new           ← right pyramid (apex above back-left vertex)
pyramid tri 3 4 new >>rot            ← triangular base (>>rot for discrete rotation only, default name: SABC)
```
- `pyramid quad`: 5 names required — apex S then base ABCD clockwise (A=front-left, B=back-left, C=back-right, D=front-right). B is the hidden vertex (dashed edges). Default name `SABCD` when omitted.

```
cone 2 4 new SO-OX                   ← base radius 2, height 4 (these are defaults)
cylinder 2 4 new O-OX-O1-O1X1        ← radius 2, height 4 (these are defaults)
```
- Cone: S=apex, O=base center, X=base rim point
- Cylinder: O/OX = bottom center/rim, O1/O1X1 = top center/rim

---

### Parallels (basis)
```
parallels new AA1BB1     ← bottom line AA1, top line BB1
parallels 4 3 new AA1BB1 ← width 4, height 3 (defaults)
```
- Draws two infinite parallel lines (AA1 on bottom, BB1 on top) in a parallelogram layout
- All 4 points are named and usable; sides AA1↔BB1 (left/right) are invisible by default
- Suppress a line with `-- none`, style with `-- dashed` etc.

---

### Figures from existing points (non-basis)
After placing a basis and adding points, draw sub-figures from named points without `new`:
```
geometry:
quadrilateral square new ABCD
point AB 1:2 new K
quadrilateral ABKL               ← quad from 4 existing points
triangle ACK                     ← triangle from existing points
circle D-DN                      ← circle from existing points
```

---

### Point
```
point AB 1:4 new K          ← on segment AB, ratio 1:4 from A
point A-AB 120 new G        ← on circle A-AB at 120°
point AD intersect BC new E ← intersection of two lines/segments
point AB A 5 right new C    ← on line AB, 5 units right of A (right/left optional)
```

---

### Line / Segment / Ray / Arrow / Distance
```
line AB                      ← infinite line through A and B
line segment CK              ← exact endpoints
line ray BC                  ← from B through C and beyond
line arrow CK                ← segment with filled arrowhead
line distance C AB new K     ← foot of perpendicular from C to line AB
```
- A `line segment` drawn on the same path suppresses any `line` or `ray` excess on that path

**Styles** (append `-- style`):
```
line AB -- dashed
line segment CK -- dotted
line ray BC -- thick          ← heavier line (2.5 pt vs default 1 pt)
line AB -- none               ← invisible (suppresses existing quad/triangle side too)
line AB -- solid              ← explicit solid (default)
```

**Derived lines** (new point D placed on the constructed line):
```
line parallel AB C new D      ← line through C parallel to AB; D is a second named point on it
line perpendicular AB C new D ← line through C perpendicular to AB
```

---

### Triangle segments
```
line perpendicular bisector KLM KL new A B    ← perp bisector of side KL → points A, B
line angle bisector KLM M new D               ← bisector from vertex M
line median KLM K new G                       ← median from vertex K
line altitude KLM K new G                     ← altitude from vertex K
line midsegment KLM KL LM new G H            ← midsegment between midpoints of KL and LM
```

---

### Inscribed / Circumscribed circles
```
circle inscribe ABC new O-OX K L M    ← K,L,M = tangent points opposite A,B,C
circle circumscribe ABC new O-OX
```

---

### Tangent to circle
```
line tangent O-OX X new Y    ← tangent at circle point X; Y is a second point along the tangent
```

---

### Arc
```
arc O-OX KL              ← minor arc from K to L on circle O-OX
arc O-OX KL bigger       ← major arc (>180°)
arc O-OX KL -- dotted
arc O-OX KL -- dashed
arc O-OX KL -- thick     ← heavier arc (3 pt vs default 1.5 pt)
arc O-OX KL -- none      ← invisible arc (hides the auto-drawn arc on a circle)
arc O-OX KL -- solid     ← explicit solid
```

---

### Label
```
label A                          ← point A labeled "A"
label A B                        ← point A labeled "B"
label a                          ← side a (= BC in ABC) labeled "a"
label AB k                       ← segment AB labeled "k"
label angle A 1                  ← angle at A labeled "1"
label angle A \beta
label arc O-OX AB bigger 220^\circ   ← major arc AB labeled
```

**Position modifiers** (after `--`):
```
label A -- top right             ← point label position
label AB a -- left               ← segment label side
label AB a -- left horizontal    ← align text along segment
label AB x\;\mathrm{cm} -- left horizontal end   ← at the end (second named point) of segment/line
```
- Point positions: `top`, `bottom`, `left`, `right`, `top left`, `top right`, `bottom left`, `bottom right`
- Segment positions: `left` / `right` (which side of segment); `horizontal` or `aligned` (text orientation); `center` (default along-segment position) or `end` (at the second named point; for a `line`, snaps to the image boundary)
- Segment label default text: lowercase matching the opposite vertex (triangle sides only)

---

### Mark
```
mark A                   ← dot on point
mark a                   ← tick on side a
mark AB III              ← triple tick on segment AB
mark angle A I           ← single arc on angle at A
mark angle A bigger II   ← double arc on reflex angle at A
mark BCA right           ← right-angle square at B in angle BCA
```
- Segment marks: `I`, `II`, `III` (default: auto-enumerate across all marks)
- Angle marks: `I`, `II`, `III` arcs, or `right` for square mark

---

### Area fill
```
area OAB                 ← fill region OAB (sector if AB is a chord on a circle, else triangle)
area OAB S_1             ← fill with label S_1 at center
area OAB -- none         ← outline only (no fill)
area OAB -- solid light  ← light grey fill
```

---

### Naming conventions
- **Point**: single uppercase letter + optional digit — `A`, `A1`, `K9`
- **Segment / Line**: two point names — `AB`, `A1B`
- **Side** (triangle only): single lowercase letter — `a` = side BC in ABC
- **Angle**: three points (vertex in middle) — `ABC`; or `angle A`; add `bigger` for reflex
- **Circle**: `center-centerpointOnCircle` — `O-OX`, `A-AB`
- **Triangle**: three uppercase letters — `ABC`
- **Pyramid**: apex + base vertices — `SABC` (tri), `SABCD` (quad)
- **Cone**: `SO-OX` (S=apex, O=base center, X=rim)
- **Cylinder**: `O-OX-O1-O1X1` (bottom center/rim, top center/rim)
- **Parallels**: `AA1BB1` (AA1=bottom line, BB1=top line)
- **Cuboid**: `ABCDA1B1C1D1`

---

### Full geometry examples

```
geometry:
circle new O-OX
point O-OX 85 new C
point O-OX -30 new B
point O-OX -135 new A
line segment OB line segment OA line segment AC line segment CB
mark O mark A mark B mark C
label O label A label B label C
```

```
geometry:
triangle right new BA[C]
label a label b label c label angle B \beta
mark angle B I mark angle C right
```

```
geometry:
circle new O-OX
point O-OX 60 new M
point O-OX 120 new N
line segment OM
line segment ON
line segment MN
label angle O 60^\circ
label OM 12\;\mathrm{cm}
```

```
geometry:
parallels new AA1BB1
line segment AA1 -- dashed
mark angle A1AB I
label AA1 a -- left horizontal end
```

---

## `interval` — sign / monotonicity diagrams

### Prefix

Only `interval:` (multi-line block format).

### Structure

```
interval:
inline <tokens>
arcs [-- all | -- closed-only | -- no-left | -- no-right]
arcs <range>
hatch <range> [-- top right | -- top left | -- bottom right | -- bottom left]
parabola [<p1> <p2>] [-- up | -- down]
```

- `inline` — **required**. All diagram tokens on one line.
- `arcs` — **optional**. If absent: no arcs drawn. Old-style (`arcs` / `arcs -- flag`) draws per-segment arcs. Range-style draws one spanning arc per declaration.
- `hatch` — **optional, repeatable**. Draws hatching over a specified range of the axis.
- `parabola` — **optional, repeatable**. Draws a parabola arc spanning from `p1` to `p2`.

---

### `inline` tokens

Everything on one line after `inline`. **Optional left labels** come first, then tokens alternate strictly: sign/hatch → point → sign/hatch → … → sign/hatch.

**Optional left labels** (must come before all other tokens):
```
^{V'(\alpha)}    ← top label on left side of axis
_{V(\alpha)}     ← bottom label on left side of axis
```
Both labels may be present in either order (`^{…}_{…}` or `_{…}^{…}`). Nested braces are supported (e.g. `^{\frac{a}{b}}`).

**Tokens**:

| Token | Meaning |
|-------|---------|
| `_text_` | plain region label (e.g. `_+_`, `_-_`, `__` for blank) |
| `=text=` | hatched (shaded) region, optional label |
| `[label]` | solid (closed) dot point |
| `(label)` | hollow (open) dot point |
| `\|label\|` | tick mark (vertical line, no dot) |
| `>label` | axis arrowhead + label; **must be the very last token** |

Labels may be **empty**: `||`, `()`, `[]` are all valid (useful when referencing by index).

**Direction arrow suffix** on any plain/hatch region token:
```
_+_up      ← draws an upward arrow below this region
_-_down    ← draws a downward arrow below this region
```

**Below-point label** — `{text}` immediately after a point token:
```
[x_0]{x_{min}}     ← solid point x_0, label x_{min} shown further below
```

---

### `arcs` — old-style (per-segment)

| Command | Effect |
|---------|--------|
| *(absent)* | no arcs anywhere |
| `arcs` or `arcs -- all` | arcs between every adjacent pair of points + both end half-arcs |
| `arcs -- closed-only` | arcs between adjacent points only, no end arcs |
| `arcs -- no-left` | suppress the left end arc only |
| `arcs -- no-right` | suppress the right end arc only |

---

### `arcs` — range-style (spanning arcs)

Draws **one arc per declaration** spanning the specified range. Multiple `arcs` lines are allowed and each produces one arc. Can be mixed freely.

**Range syntax**: `FROM-TO` where `-` separates endpoint references. Empty side = open to infinity.

| Declaration | Arc drawn |
|-------------|-----------|
| `arcs -<N>` | Quarter-arc from −∞ side ending at point N |
| `arcs <N>-` | Quarter-arc from point N stretching to +∞ side |
| `arcs <M>-<N>` | Full semicircle from point M to point N |
| `arcs -<M>-<N>-` | Three arcs in one line (shorthand for three separate declarations) |

**Endpoint references**: `<N>` = 1-based index; label name (e.g. `n_1`) also works.

**Open-end behaviour**:
- `-<1>` where `<1>` is the **first** point → standard small quarter-arc (nothing skipped).
- `<N>-` where `<N>` is the **last** point → standard small quarter-arc (nothing skipped).
- When points are being skipped (e.g. `<2>-` with 4 points total), the arc is stretched so its 90° cut lands exactly at the axis end, visually spanning over the skipped points.

```
interval:
inline __[]__[]__[]__[]__>x
arcs -<1>
arcs <1>-<2>
arcs <2>-
```

Compact equivalent:
```
interval:
inline __[]__[]__[]__[]__>x
arcs -<1>-<2>-
```

---

### `hatch` command

Draws diagonal hatching lines over a range of the axis. Repeatable; independent of `=…=` inline hatching.

**Syntax**: `hatch <range> [-- top right | -- top left | -- bottom right | -- bottom left]`

**Default direction cycles** automatically when no `--` flag is given:

| Order | Default direction |
|-------|------------------|
| 1st `hatch` | `top right` (`/` above axis) |
| 2nd `hatch` | `bottom right` (`\` below axis) |
| 3rd `hatch` | `top left` (`\` above axis) |
| 4th `hatch` | `bottom left` (`/` below axis) |
| 5th+ | wraps back to `top right` |

An explicit `-- direction` flag overrides the default but the counter still advances.

**Range syntax** is the same as for `arcs` (`-<N>`, `<M>-<N>`, `<N>-`, compound `-<M>-<N>-`).

```
interval:
inline __[]__[]__[]__[]__>x
hatch -<1>
hatch <1>-<3>
hatch <2>-
```

With explicit directions:
```
interval:
inline __[]__[]__[]__[]__>x
hatch -<1>
hatch <1>-<3> -- top right
hatch <2>- -- bottom left
```

---

### `parabola` command

```
parabola                      ← first two points, opening up (default)
parabola -- down              ← first two points, opening down
parabola <p1> <p2>            ← named or indexed points, opening up
parabola <p1> <p2> -- up
parabola <p1> <p2> -- down
```

**Point references** (`<p1>`, `<p2>`):
- By label: `n_1`, `x_0`, `e` — the label used in the `inline` token
- By 1-based index: `<1>`, `<2>`, `<3>` — required when labels are empty or duplicated

`p1` must come before `p2` in the inline sequence; they do **not** need to be adjacent. The parabola spans from the x-position of `p1` to `p2`, suppressing any individual arcs in between. Peak height is constant regardless of span width (`a = 4/d²`).

For **adjacent** point spans (`p2` immediately follows `p1`), point labels are nudged slightly to avoid overlapping the parabola feet. For **non-adjacent** spans, labels stay at their natural positions.

Multiple `parabola` lines are allowed.

---

### Rules
- `inline` tokens must strictly alternate: sign/hatch, point, sign/hatch, …, sign/hatch
- For N points there must be exactly N+1 sign/hatch tokens
- `>label` arrow must be the very last token (omit entirely if no arrow needed)
- Non-empty point labels must be unique; empty labels (`||`, `()`, `[]`) may repeat freely
- `arcs` range-style and old-style cannot be mixed (range-style takes over if any range is present)
- `parabola p1 p2`: both references must resolve and `p1` must come before `p2`
- `parabola` (no names): inline must have at least 2 points

---

### Examples

```
interval:
inline _-_ (0) =+= (4) _-_ >x
arcs
```

```
interval:
inline ^{V'(\alpha)}_{V(\alpha)} __ (0) _+_up [^{\arcsin\frac{\sqrt3}{3}}]{x_{max}} _-_down (\frac{\pi}{2}) __ >\alpha
arcs -- closed-only
```

```
interval:
inline ^{f'(x)}_{f(x)} __ [\frac{1}{e}] _+_up |e| _-_down [e^3] __ >x
arcs -- closed-only
```

```
interval:
inline _-_ |n_1| =+= |n_2| _-_ >x
parabola n_1 n_2 -- down
```

```
interval:
inline _-_ |n_1| =+= |n_2| _-_ (4) __ >x
parabola <1> <3> -- down
```

```
interval:
inline _-_ || =+= || _-_ () __
parabola <1> <2> -- down
```

```
interval:
inline __[]__[]__[]__[]__>x
arcs -<1>
arcs <1>-<2>
arcs <2>-
```

```
interval:
inline __[]__[]__[]__[]__>x
hatch -<1>
hatch <1>-<3>
hatch <2>-
```

---

## `unit-circle` — annotated unit circle

### Prefix
```
unit-circle:
```

The circle, axes, labels ±1, and center O are always drawn. Point `X` at 0° is always implicit.

### Commands (one per line)

**Declare a point on the circle:**
```
point <angle> new <Name>
```
- `<angle>` — degrees (integer, decimal, or negative) **or** pi notation: `pi`, `-pi`, `2pi`, `1.5pi`, `1/2pi`, `3/4pi`, `11/6pi`, etc.
- Examples: `point 120 new A`, `point -30 new B`, `point 1/2pi new C`, `point 1.5pi new D`

**Label a point:**
```
label <Name> [text]      ← filled dot + label
label <Name> (text)      ← hollow dot + label
label <Name> text        ← label only, no dot
```
- Label position is auto-placed: right side of point if x≥0, left side if x<0.

**Rotation arc with arrowhead:**
```
rotangle <fromName>-<toName>
rotangle <fromName>-<toName> <arcLabel>
```
Draws a small arc at the origin from angle `from` to angle `to`, with an arrowhead at `to` and an optional label near the arc. Also draws radii to both points.
- Clockwise arc if `toDeg < fromDeg`, counter-clockwise otherwise.
- Arc label is optional.
- When multiple `rotangle`/`angle` commands are used, each gets a distinct radius (1st=0.6, 2nd=0.45, 3rd=0.75 growing by 0.15).
- Spans >360° produce a spiral arc (phases: flat semicircle → expand ry → expand rx, repeating).

**Arc without arrowhead:**
```
angle <fromName>-<toName>
angle <fromName>-<toName> <arcLabel>
```
Same as `rotangle` but no arrowhead. Shares the same radius sequence as `rotangle`.

**Projection lines to axes:**
```
x-line <Name>                                    ← vertical dotted line to x-axis
x-line <Name> <axisLabel>                        ← with label on x-axis
x-line <Name> -- dashed                          ← dashed style
x-line <Name> -- solid
x-line <Name> <axisLabel> -- dashed right-angle  ← label + right-angle mark at foot
x-line <Name> -- dashed right-angle              ← right-angle mark only

y-line <Name>                                    ← horizontal dotted line to y-axis
y-line <Name> <axisLabel>
y-line <Name> -- dashed
y-line <Name> <axisLabel> -- solid right-angle
```
- Default style is `dotted`. Options: `dotted`, `dashed`, `solid`.
- `<axisLabel>` is a LaTeX math token (e.g. `x_M`, `\cos\alpha`); rendered at the foot on the axis.
- Label side is auto-placed: x-axis label below if point is above (y>0), above if below (y<0); y-axis label left if point is to the right (x>0), right if to the left (x<0).
- `right-angle` draws a small right-angle square at the foot of the projection.

**Full straight lines through the diagram:**
```
line x=<value>    ← vertical line at x = value × RADIUS
line y=<value>    ← horizontal line at y = value × RADIUS
```
- Values are in unit-circle units (1 = radius of the circle). E.g. `line y=1` draws at the top of the circle.
- Negative and decimal values are accepted: `line x=-0.5`, `line y=0.5`.

### Examples
```
unit-circle:
point 120 new A
point -60 new B
label A [A]
label B (B)
x-line A
y-line B -- dashed
```

```
unit-circle:
point 240 new M
label M [M(x;y)]
rotangle X-M 240^\circ
x-line M x_M -- dashed right-angle
y-line M y_M -- dashed right-angle
```

```
unit-circle:
point 1/2pi new A
point 3/4pi new B
label A [A]
label B [B]
rotangle X-A \frac{\pi}{2}
angle A-B \frac{\pi}{4}
```

```
unit-circle:
point 60 new A
rotangle X-A
line y=0.5
line x=1
```
