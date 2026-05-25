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

Only **one basis** (triangle, circle, or quadrilateral) per diagram. Everything else is drawn on top of existing named points/segments.

---

### Triangle (basis)

**Keyword form:**
```
triangle ABC                           ← scalene acute (default)
triangle right A[B]C                   ← right angle at B ([] marks special vertex)
triangle obtuse [A]BC                  ← obtuse angle at A
triangle isosceles A[B]C               ← isosceles, apex at B
triangle equilateral ABC
triangle right isosceles A[B]C         ← right+isosceles at B
```
- Angle type: `acute` (default), `right`, `obtuse`
- Side type: `scalene` (default), `isosceles`, `equilateral`
- `[X]` marks the special vertex (right angle / obtuse / isosceles apex)
- Default layout: A=bottom-left, B=top, C=bottom-right

**Congruence form** (specific side/angle values):
```
triangle SSS 3 4 6 ABC
triangle SAS 3 120 4 ABC
triangle ASA 120 3 30 ABC
triangle AAS 120 30 3 ABC >>rot >>rot120 >>invert
```
Values follow congruence-rule order (sides in units, angles in degrees).

| Mode | Values |
|------|--------|
| SSS  | side AB, side BC, side CA |
| SAS  | side AB, angle B, side BC |
| ASA  | angle A, side AB, angle B |
| AAS  | angle A, angle B, side BC |

Rotation / inversion:
- `>>rot` — rotate so the next side is horizontal
- `>>rot120` / `>>rot-240` — rotate by degrees (clockwise)
- `>>invert` — mirror by Y axis

---

### Circle (basis)
```
circle O-OX
circle A-AB
circle 5 O-OX            ← custom radius 5 (default 2)
```
Format: `center-centerpointOnCircle`. The point after the dash is on the circle at 0° (rightmost). `O-OX` means center O, X is at 0°.

**Oval transform:**
```
circle O-OX >>h0.5       ← squish the Y axis by 0.5 → oval
```

---

### Quadrilateral (basis)
```
quadrilateral square ABCD
quadrilateral rectangle ABCD
quadrilateral parallelogram ABCD
quadrilateral rhombus ABCD
quadrilateral trapezoid ABCD
quadrilateral right trapezoid ABCD
quadrilateral isosceles trapezoid ABCD
quadrilateral SSSSD 1 2 3 4 2 ABCD    ← 4 sides + 1 diagonal
quadrilateral SSSDD 1 2 3 2 3 ABCD    ← 3 sides + 2 diagonals
quadrilateral SSAAA 3 3 90 90 90 ABCD ← 2 adjacent sides + 3 angles
quadrilateral SSSAA 3 3 3 90 90 ABCD  ← 3 sides + 2 included angles
```
Vertices: bottom-left → clockwise → ABCD. Supports `>>rot`, `>>rotN`, `>>invert`.

---

### 3D basis (cube / pyramid)
```
geometry:
cube new ABCDA1B1C1D1
cube 4 new                           ← custom side length
cuboid 3x4x5 new                     ← length × width × height (AD × AB × AA1)
```

```
geometry:
pyramid quad 4 4 new SABC            ← quadrilateral base, base=4, height=4
pyramid quad right 2 3 new           ← right pyramid (BS is height)
pyramid tri 3 4 new >>rot            ← triangular base
```

---

### Figures from existing points (non-basis)
After placing a basis and adding points, you can draw sub-figures from named points without `new`:
```
geometry:
quadrilateral square new ABCD
point AB 1:2 new K
point BC 1:2 new L
quadrilateral ABMN               ← quad from 4 existing points
triangle ACK                     ← triangle from existing points
circle D-DN                      ← circle from existing points
```

---

### Point
```
point AB 1:4 new K          ← on segment AB, ratio 1:4 from A
point A-AB 120 new G        ← on circle A-AB at 120°
point AD intersect BC new E ← intersection of two lines/segments
point AB A 5 right new C    ← on line AB, 5 units right of A
```

---

### Line / Segment / Ray / Arrow / Distance
```
line AB
line segment CK
line ray BC
line arrow CK
line distance C AB new K     ← foot of perpendicular from C to AB
```
- `line` — full line through two points
- `line segment` — exact endpoints only
- `line ray` — from first point through second
- `line arrow` — segment with arrowhead
- Segment excess is trimmed when a shorter element is drawn on the same path

**Style:**
```
line AB -- dashed
line segment CK -- dotted
```

---

### Triangle segments
```
line perpendicular bisector KLM KL new A B    ← perpendicular bisector of side KL
line angle bisector KLM M new D               ← bisector from vertex M
line median KLM K new G                       ← median from vertex K
line altitude KLM K new G                     ← altitude from vertex K
line midsegment KLM KL LM new G H            ← midsegment between KL and LM
```

---

### Inscribed / Circumscribed circles
```
circle inscribe ABC new O-OX K L M    ← K,L,M are tangent points opposite A,B,C
circle circumscribe ABC new O-OX
```

---

### Tangent to circle
```
line tangent O-OX X new Y    ← tangent at circle point X; Y is further along the tangent
```

---

### Arc
```
arc O-OX KL              ← minor arc from K to L on circle O-OX
arc O-OX KL bigger       ← major arc (>180°)
arc O-OX KL -- dotted
arc O-OX KL -- none      ← invisible arc (useful for positioning)
```

---

### Label
```
label A                  ← labels point A with "A"
label A B                ← labels point A with "B"
label a                  ← labels side a (= BC in triangle ABC) with "a"
label AB k               ← labels segment AB with "k"
label angle A 1          ← labels angle at A with "1"
label angle A \beta
label arc O-OX AB bigger 220^\circ   ← labels the major arc AB
label A -- top right     ← explicit position
label AB a -- left
label AB a -- left horizontal        ← align text along segment
```
- Point positions: `top`, `bottom`, `left`, `right`, `top left`, `top right`, `bottom left`, `bottom right`
- Segment positions: `left`, `right`; add `horizontal` to align text along the segment
- Segment label default: lowercase letter matching the opposite vertex (triangle sides only)

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
- Segment marks: `I`, `II`, `III` (default: auto-enumerate)
- Angle marks: `I`, `II`, `III` arcs, or `right` for square mark

---

### Area fill
```
area OAB                 ← fill region OAB
area OAB S_1             ← fill with label S_1 at center
area OAB -- none         ← outline only
area OAB -- solid light  ← light fill
```
If segment AB exists → sector; if it doesn't → triangle fill.

---

### Naming conventions
- **Point**: single uppercase letter + optional digit — `A`, `A1`, `K9`
- **Segment**: two point names — `AB`, `A1B` (same as `BA`)
- **Side** (triangle only): single lowercase letter — `a` = side BC in ABC
- **Angle**: three points (vertex in middle) — `ABC`; or `angle A` (any angle at A); `angle A bigger` for reflex
- **Circle**: `center-centerpointOnCircle` — `O-OX`, `A-AB`
- **Triangle**: three uppercase letters — `ABC`

---

### Full geometry examples

```
geometry:
circle O-OX
point O-OX 85 new C
point O-OX -30 new B
point O-OX -135 new A
line segment OB line segment OA line segment AC line segment CB
mark O mark A mark B mark C
label O label A label B label C
```

```
geometry:
triangle right BA[C]
label a label b label c label angle B \beta
mark angle B I mark angle C right
```

```
geometry:
circle O-OX
point O-OX 60 new M
point O-OX 120 new N
line segment OM
line segment ON
line segment MN
label angle O 60^\circ
label OM 12\;\mathrm{cm}
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
parabola [<p1> <p2>] [-- up | -- down]
```

- `inline` — **required**. All diagram tokens on one line.
- `arcs` — **optional**. If absent: no arcs drawn anywhere. If present with no flag (`arcs` alone): all arcs (between points + both end half-arcs). Flags restrict which arcs appear.
- `parabola` — **optional, repeatable**. Draws a parabola arc spanning from `p1` to `p2` (replacing any arcs in that span). Can span non-adjacent points.

---

### `inline` tokens

Everything on one line after `inline`. **Optional left labels** come first, then tokens alternate strictly: sign/hatch → point → sign/hatch → … → sign/hatch.

**Optional left labels** (must come before all other tokens):
```
^{V'(\alpha)}    ← top label on left side of axis
_{V(\alpha)}     ← bottom label on left side of axis
```

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

### `arcs` flags

| Command | Effect |
|---------|--------|
| *(absent)* | no arcs anywhere |
| `arcs` or `arcs -- all` | arcs between every pair of adjacent points + both end half-arcs |
| `arcs -- closed-only` | arcs between adjacent points only, no end arcs |
| `arcs -- no-left` | suppress the left end arc only |
| `arcs -- no-right` | suppress the right end arc only |

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
- By 1-based index: `<1>`, `<2>`, `<3>` — useful when labels are empty or duplicated

`p1` must come before `p2` in the inline sequence; they do **not** need to be adjacent. The parabola spans from the x-position of `p1` to `p2`, suppressing any individual arcs in between. Peak height is constant regardless of how far apart the points are.

Multiple `parabola` lines are allowed.

---

### Rules
- `inline` tokens must strictly alternate: sign/hatch, point, sign/hatch, …, sign/hatch
- For N points there must be exactly N+1 sign/hatch tokens
- `>label` arrow must be the very last token (omit entirely if no arrow needed)
- Non-empty labels must be unique; empty labels (`||`, `()`, `[]`) may repeat freely
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
- `<angle>` — degrees (integer or decimal, can be negative) **or** `n/dpi` notation
- Examples: `point 120 new A`, `point -30 new B`, `point 1/2pi new C`, `point 3/4pi new D`

**Label a point:**
```
label <Name> [text]      ← filled dot + label
label <Name> (text)      ← hollow dot + label
label <Name> text        ← label only, no dot
```

**Rotation arc with arrowhead:**
```
rotangle <fromName>-<toName> <arcLabel>
```
Draws a small arc at the origin from angle `from` to angle `to`, with an arrowhead at `to` and a label at the arc midpoint. Also draws radii to both points.
- Clockwise arc if `toDeg < fromDeg`, counter-clockwise otherwise.

**Projection lines:**
```
x-line <Name>                      ← vertical dotted line to x-axis (default dotted)
x-line <Name> -- dashed
x-line <Name> -- solid
y-line <Name>                      ← horizontal dotted line to y-axis
y-line <Name> -- dashed
```

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
x-line M -- dashed
y-line M
```

```
unit-circle:
point 1/2pi new A
point 3/4pi new B
label A [A]
label B [B]
rotangle X-A \frac{\pi}{2}
```
