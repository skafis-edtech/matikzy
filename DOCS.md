# Docs

## Syntax

### `function`

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
