function syntaxCheck(_content) { return { valid: true }; }

function compile(_content) {
  return String.raw`\usepackage{pgfplots}

\begin{document}

\begin{tikzpicture}
    \begin{axis}[
        axis lines=middle,
        xlabel={$x$},
        ylabel={$y$},
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
        width=7cm,
        height=3cm
    ]
        \addplot[thick, violet] {sqrt(x) + 2};
    \end{axis}
\end{tikzpicture}

\end{document}`;
}

export default [
  { prefix: "function: ", syntaxCheck, compile },
];
