function syntaxCheck(_content) {
  return { valid: true, errors: [] };
}

function compile(_content) {
  return [
    `% Circle`,
    `\\draw[line width=1.2pt, fill=white] (0,0) circle (2.5);`,
    ``,
    `% Axes`,
    `\\draw[line width=1pt] (-3.5,0) -- (3.5,0);`,
    `\\fill (3.5,0) -- (3.3,0.1) -- (3.3,-0.1) -- cycle;`,
    `\\node[below, scale=1.5] at (3.4,0) {$x$};`,
    `\\draw[line width=1pt] (0,-3.5) -- (0,3.5);`,
    `\\fill (0,3.5) -- (-0.1,3.3) -- (0.1,3.3) -- cycle;`,
    `\\node[left, scale=1.5] at (0,3.4) {$y$};`,
    ``,
    `% Ones`,
    `\\node[below, scale=1.5] at (2.7,0) {$1$};`,
    `\\node[below, scale=1.5] at (-2.9,0) {$-1$};`,
    `\\node[above, scale=1.5] at (-0.2,2.5) {$1$};`,
    `\\node[below, scale=1.5] at (-0.4,-2.5) {$-1$};`,
    ``,
    `% Center point`,
    `\\node[below, scale=1.5] at (-0.3,0) {$O$};`,
  ].join("\n");
}

export default [
  { prefix: "unit-circle:", syntaxCheck, compile },
];
