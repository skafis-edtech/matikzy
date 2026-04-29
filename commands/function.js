function syntaxCheck(_content) {
  return { valid: true };
}

function compile(_content) {
  return String.raw`\usepackage{pgfplots}

\begin{document}
\begin{tikzpicture}[scale=1.7, transform shape]
    \begin{axis}[
        axis lines=middle,
        xlabel={$x$},
        ylabel={$y$},
        xlabel style={at={(ticklabel* cs:1.0)}, anchor=north},
        ylabel style={at={(ticklabel* cs:1.0)}, anchor=east},
        samples=100,
        domain=0:9,
        ymin=0, ymax=5,
        xmin=-0.5, xmax=9,
        xtick={0,1},
        ytick={0,1,2},
        extra x ticks={0},
        extra x tick labels={$0$},
        extra x tick style={tick label style={font=\small}},
        tick label style={font=\small},
        scale only axis,
        width=5.6cm,
        height=2.4cm,
    ]
        \addplot[thick, black] {sqrt(x) + 2};
    \end{axis}
\end{tikzpicture}
\end{document}`;
}

export default [{ prefix: "function: ", syntaxCheck, compile }];
