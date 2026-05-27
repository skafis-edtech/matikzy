// tests/regression.test.js
// Run with: node --test tests/regression.test.js
// or with Vitest/Jest after minor assertion tweaks.

import test from "node:test";
import assert from "node:assert/strict";

import { compile, syntaxCheck } from "../matikzy.js";

const CASES = [
  // ---------------------------------------------------------------------------
  // INTERVALS
  // ---------------------------------------------------------------------------
  {
    name: "interval method in rational inequality",
    input: `interval:
    inline _-_ (0) =+= [4] _-_ [5] =+= >x
    arcs
    `,
    expected: String.raw`
    \begin{document}

    \begin{tikzpicture}
    % Left labels
    % Axis
    \draw[line width=1pt] (-4,0) -- (2,0);
    \fill (2,0) -- (1.8,0.1) -- (1.8,-0.1) -- cycle;
    \node[below, scale=1.5] at (1.9,0) {$x$};
    % Points
    \draw[line width=1.5pt, fill=white] (-3,0) circle (3.5pt);
    \node[below, scale=1.5] at (-3,0) {$0$};
    \fill (-1,0) circle (3pt);
    \node[below, scale=1.5] at (-1,0) {$4$};
    \fill (1,0) circle (3pt);
    \node[below, scale=1.5] at (1,0) {$5$};
    % Signs
    \node[above, scale=1.5] at (-3.7,0) {$-$};
    \node[above, scale=1.5] at (-2,0) {$+$};
    \node[above, scale=1.5] at (0,0) {$-$};
    \node[above, scale=1.5] at (1.7,0) {$+$};
    % Arcs
    \draw[thick] (-3,0) arc[start angle=0, end angle=90, x radius=1, y radius=0.7];
    \draw[thick] (-3,0) arc[start angle=180, end angle=0, x radius=1, y radius=0.7];
    \draw[thick] (-1,0) arc[start angle=180, end angle=0, x radius=1, y radius=0.7];
    \draw[thick] (1,0) arc[start angle=180, end angle=90, x radius=1, y radius=0.7];
    % Parabolas
    % Arrows below
    % Hatching
    \foreach \x in {-3,-2.85,...,-1} {
        \draw[line width=1pt] (\x,0) -- (\x+0.20,0.20);
    }
    \foreach \x in {1,1.15,...,2} {
        \draw[line width=1pt] (\x,0) -- (\x+0.20,0.20);
    }
    \end{tikzpicture}

    \end{document}
    `.trim(),
  },
];

function normalizeTikz(s) {
  return (
    s
      // normalize line endings
      .replace(/\r\n/g, "\n")

      .split("\n")

      // remove LaTeX comments
      .map((line) => {
        const i = line.indexOf("%");
        return i === -1 ? line : line.slice(0, i);
      })

      // trim each line
      .map((line) => line.trim())

      // remove empty lines
      .filter((line) => line.length > 0)

      // collapse multiple spaces/tabs
      .map((line) => line.replace(/\s+/g, " "))

      .join("\n")
      .trim()
  );
}

// -----------------------------------------------------------------------------
// VALID REGRESSION TESTS
// -----------------------------------------------------------------------------

for (const tc of CASES) {
  test(`compile(): ${tc.name}`, () => {
    const syntax = syntaxCheck(tc.input);

    assert.equal(
      syntax.valid,
      true,
      `Expected syntax to be valid:\n${JSON.stringify(syntax, null, 2)}`,
    );

    const tikz = compile(tc.input);

    assert.equal(typeof tikz, "string");

    assert.equal(normalizeTikz(tikz), normalizeTikz(tc.expected));
  });
}
