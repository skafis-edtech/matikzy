function syntaxCheck(content) {
  const errors = [];
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { valid: true, errors: [] };
  const words = lines[0].split(/\s+/);
  if (words.length !== 3) {
    errors.push('"venn": optional first line must be exactly 3 set labels, e.g. "A B C"');
  }
  if (lines.length > 1) {
    errors.push('"venn": only one optional line of 3 labels is accepted');
  }
  return { valid: errors.length === 0, errors };
}

function compile(content) {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  let labels = ["A", "B", "C"];
  if (lines.length > 0) {
    const words = lines[0].split(/\s+/);
    if (words.length === 3) labels = words;
  }

  const [lA, lB, lC] = labels;

  // Circle centers arranged in a triangle
  const cA = [-1.15, 0.66];
  const cB = [1.15, 0.66];
  const cC = [0, -0.82];
  const r = 1.72;

  const out = [];
  out.push("\\begin{document}");
  out.push("");
  out.push("\\begin{tikzpicture}");

  // Filled circles (blended overlap)
  out.push("\\begin{scope}[fill opacity=0.25]");
  out.push(`\\fill[blue] (${cA[0]}, ${cA[1]}) circle (${r});`);
  out.push(`\\fill[red] (${cB[0]}, ${cB[1]}) circle (${r});`);
  out.push(`\\fill[green!70!black] (${cC[0]}, ${cC[1]}) circle (${r});`);
  out.push("\\end{scope}");

  // Circle outlines
  out.push(`\\draw[line width=1.2pt] (${cA[0]}, ${cA[1]}) circle (${r});`);
  out.push(`\\draw[line width=1.2pt] (${cB[0]}, ${cB[1]}) circle (${r});`);
  out.push(`\\draw[line width=1.2pt] (${cC[0]}, ${cC[1]}) circle (${r});`);

  // Labels placed in the exclusive region of each circle
  const lOff = r * 0.62;
  out.push(`\\node[scale=1.4] at (${cA[0] - lOff}, ${cA[1] + lOff * 0.65}) {$${lA}$};`);
  out.push(`\\node[scale=1.4] at (${cB[0] + lOff}, ${cB[1] + lOff * 0.65}) {$${lB}$};`);
  out.push(`\\node[scale=1.4] at (${cC[0]}, ${cC[1] - lOff * 0.9}) {$${lC}$};`);

  out.push("\\end{tikzpicture}");
  out.push("");
  out.push("\\end{document}");

  return out.join("\n");
}

export default [{ prefix: "venn:", syntaxCheck, compile }];
