# Docs

## `function`

Examples:

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

```
function[large]:
axes Ox[-1;4]{0;1} Oy[-1;4]{1;2}
point (0;2) []
point (0;0) []
graph sqrt >>f(x)+2
```

```
function:
axes Oy[-0.8;0.8]{-1;0;1} x2 Ox[-0.5;2]{1/3=30^\circ; 1=90^\circ; 5/3=150^\circ; 2=180^\circ} x3
graph sin
graph line y=0.5
point (0.3333;0.5) [] x-line
point (1.6666;0.5) [] x-line
```

Explanation:

Starts with `function:`. Can have `function[small]:`, `function[large]:` and can have (combining possible) `function[grid]:`.

Then these keywords (with whitespaces before) separates sections:
`axes`, `graph`, `point`, `area`, `angle`.

Syntax BNF:

```
<content> ::= <segment> { <space> <segment> }

<segment> ::= <axes>
            | <point>
            | <area>
            | <angle>
            | <graph>

<axes> ::= "axes" [ <space> <axis-def> ] [ <space> <axis-def> ]

<axis-def> ::= ("Ox" | "Oy")
               [ "=" <label> ]
               [ <space> <range-bracket> ]
               [ <space> <tick-block> ]
               [ <space> <scale> ]

<range-bracket> ::= "[" [ <number> ] ";" [ <number> ] "]"

<tick-block> ::= "{" <tick-list> "}"
<tick-list> ::= "all"
              | <tick> { ";" <tick> }

<tick> ::= <value> [ "=" <label> ]

<scale> ::= "x" <signed-number>

--------------------------------------------------

<point> ::= "point" <space>
            "(" <number> ";" <number> ")"
            [ <space> <point-extra> ]

<point-extra> ::= "[" <label> "]"
                | "(" <label> ")"
                | <label>
                [ <space> <point-flags> ]

<point-flags> ::= { "x-line" | "y-line" }

--------------------------------------------------

<area> ::= "area" <space>
           "(" <number> ";" <number> ")"
           [ <space> <label> ]

--------------------------------------------------

<angle> ::= "angle" [ <space> "right" ] <space>
            "(" <number> ";" <number> ")" <space>
            "(" <number> ";" <number> ")" <space>
            "(" <number> ";" <number> ")"
            [ <space> <label> ]

--------------------------------------------------

<graph> ::= "graph" <space> <graph-type>
            [ <space> <graph-body> ]
            [ <ranges> ]
            [ <transforms> ]

<graph-type> ::= "line"
               | "parabola"
               | "cubic"
               | "sqrt"
               | "cbrt"
               | "log"
               | "exp"
               | "sin" | "cos" | "tan" | "tg" | "cot" | "ctg"
               | "circle"
               | "hyperbola"
               | "generic"

--------------------------------------------------

<graph-body> ::= <line-body>
               | <parabola-body>
               | <cubic-body>
               | <generic-body>
               | <circle-body>
               | <hyperbola-body>
               | <logexp-body>
               | ε

<line-body> ::= "y=" <linear-expr>
              | "(" <number> ";" <number> ")" <space>
                "(" <number> ";" <number> ")"
              | "x=" <number>

<linear-expr> ::= [ <signed-number> ] "x"
                  [ <signed-number> ]
                | <number>

--------------------------------------------------

<parabola-body> ::= "y=" <parabola-expr>
                  | <point> <space> <point> <space> <point>

<parabola-expr> ::= <number> "x^2"
                    [ <signed-number> "x" ]
                    [ <signed-number> ]
                  | <number> "(x" <signed-number> ")^2"
                    [ <signed-number> ]
                  | <number> "(x" <signed-number> ")"
                    "(x" <signed-number> ")"

--------------------------------------------------

<cubic-body> ::= "y=" <cubic-expr>
               | <point> <space> <point> <space>
                 <point> <space> <point>

<cubic-expr> ::= <number> "x^3"
                 [ <signed-number> "x^2" ]
                 [ <signed-number> "x" ]
                 [ <signed-number> ]

--------------------------------------------------

<generic-body> ::= [ "smooth" <space> ]
                   ( "y=" <expression>
                   | <generic-points> )

<generic-points> ::= <gpoint> { <space> <gpoint> }
<gpoint> ::= [ "v" | "^" ]
             "(" <number> ";" <number> ")"

--------------------------------------------------

<circle-body> ::= [ "(" <number> ";" <number> ")" ]
                  [ <space> "r=" <number> ]

<hyperbola-body> ::= "k=" <number>

<logexp-body> ::= [ "a=" <number> ]

--------------------------------------------------

<ranges> ::= [ <space> "x[" [ <number> ] ";" [ <number> ] "]" ]
             [ <space> "y[" [ <number> ] ";" [ <number> ] "]" ]

--------------------------------------------------

<transforms> ::= { <space> ">>" <space> <transform> }

<transform> ::= "|f(x)|"
              | "-f(x)"
              | "f(-x)"
              | <number> "*f(x)"
              | "f(x" <signed-number> ")"
              | "f(" <number> "*x)"
              | "f(x)" <signed-number>

--------------------------------------------------

<number> ::= <signed-number>
<signed-number> ::= [ "+" | "-" ] <numeric>

<numeric> ::= <integer>
            | <integer> "." [ <integer> ]
            | "." <integer>
            | <integer> "/" <integer>

<label> ::= <string>
<value> ::= <string>
<expression> ::= <string>

<space> ::= " " { " " }
<string> ::= { any character except structural delimiters }
```
