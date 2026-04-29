function parseTicks(tickStr, min, max) {
  if (tickStr === undefined) return [];
  if (tickStr.trim() === "all") {
    const ticks = [];
    for (let i = Math.ceil(min); i <= Math.floor(max); i++)
      ticks.push({ value: String(i), label: String(i) });
    return ticks;
  }
  return tickStr
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const eq = s.indexOf("=");
      if (eq !== -1) return { value: s.slice(0, eq).trim(), label: s.slice(eq + 1).trim() };
      return { value: s, label: s };
    });
}

function parseAxisLine(line) {
  const m = line.match(/^axis\s+([xy])\s+\[([^;]+);([^\]]+)\](?:\s*\{([^}]*)\})?$/);
  if (!m) return null;
  return { axis: m[1], min: parseFloat(m[2]), max: parseFloat(m[3]), tickStr: m[4] };
}

function parsePointLine(line) {
  const m = line.match(/^point\s+\(([^;]+);([^)]+)\)(.*)/);
  if (!m) return null;
  const x = parseFloat(m[1].trim());
  const y = parseFloat(m[2].trim());
  let rest = m[3].trim();

  let label = null;
  let pointStyle = null;

  const filledMatch = rest.match(/^\[([^\]]*)\](.*)/);
  if (filledMatch) {
    label = filledMatch[1].trim() || null;
    pointStyle = "filled";
    rest = filledMatch[2].trim();
  } else {
    const hollowMatch = rest.match(/^\(([^;)]*)\)(.*)/);
    if (hollowMatch) {
      label = hollowMatch[1].trim() || null;
      pointStyle = "hollow";
      rest = hollowMatch[2].trim();
    } else {
      const words = rest.split(/\s+/);
      if (words[0] && words[0] !== "x-line" && words[0] !== "y-line") {
        label = words[0];
        rest = words.slice(1).join(" ");
      }
    }
  }

  return { x, y, label, pointStyle, xLine: rest.includes("x-line"), yLine: rest.includes("y-line") };
}

function parseContent(content) {
  const lines = content.split("\n").map((l) => l.trim());
  const xParsed = lines.map(parseAxisLine).find((p) => p?.axis === "x");
  const yParsed = lines.map(parseAxisLine).find((p) => p?.axis === "y");
  if (!xParsed || !yParsed) return null;
  return {
    xMin: xParsed.min, xMax: xParsed.max, xTicks: parseTicks(xParsed.tickStr, xParsed.min, xParsed.max),
    yMin: yParsed.min, yMax: yParsed.max, yTicks: parseTicks(yParsed.tickStr, yParsed.min, yParsed.max),
    points: lines.map(parsePointLine).filter(Boolean),
  };
}

function syntaxCheck(content) {
  const p = parseContent(content.trim());
  if (!p)
    return {
      valid: false,
      errors: [
        "Expected: axis x [min;max] and axis y [min;max] lines (optionally with {ticks} or {all})",
      ],
    };
  if (isNaN(p.xMin) || isNaN(p.xMax))
    return { valid: false, errors: ["Invalid x range"] };
  if (isNaN(p.yMin) || isNaN(p.yMax))
    return { valid: false, errors: ["Invalid y range"] };
  if (p.xMin >= p.xMax)
    return { valid: false, errors: ["x min must be less than x max"] };
  if (p.yMin >= p.yMax)
    return { valid: false, errors: ["y min must be less than y max"] };
  return { valid: true };
}

const UNIT_CM = 1.2;
const EXT = 0.5;

function compile(content, grid = false) {
  const { xMin, xMax, xTicks, yMin, yMax, yTicks, points } = parseContent(
    content.trim(),
  );

  const xStart = xMin - EXT;
  const xEnd = xMax + EXT;
  const yStart = yMin - EXT;
  const yEnd = yMax + EXT;

  const lines = [];

  if (grid) {
    lines.push(`% Grid`);
    for (let i = Math.ceil(xMin); i <= Math.floor(xMax); i++)
      lines.push(`\\draw[gray, line width=0.5pt] (${i},${yStart}) -- (${i},${yEnd});`);
    for (let i = Math.ceil(yMin); i <= Math.floor(yMax); i++)
      lines.push(`\\draw[gray, line width=0.5pt] (${xStart},${i}) -- (${xEnd},${i});`);
  }

  lines.push(`% X Axis`);
  lines.push(`\\draw[line width=1pt] (${xStart},0) -- (${xEnd},0);`);
  lines.push(
    `\\fill (${xEnd},0) -- (${xEnd - 0.2},0.1) -- (${xEnd - 0.2},-0.1) -- cycle;`,
  );
  lines.push(`\\node[below, scale=1.5] at (${xEnd - 0.1},0) {$x$};`);

  lines.push(`% Y Axis`);
  lines.push(`\\draw[line width=1pt] (0,${yStart}) -- (0,${yEnd});`);
  lines.push(
    `\\fill (0,${yEnd}) -- (-0.1,${yEnd - 0.2}) -- (0.1,${yEnd - 0.2}) -- cycle;`,
  );
  lines.push(`\\node[left, scale=1.5] at (0,${yEnd - 0.1}) {$y$};`);

  const zeroXTick = xTicks.find((t) => t.value === "0");
  const zeroYTick = yTicks.find((t) => t.value === "0");
  const zeroTick = zeroXTick ?? zeroYTick;

  lines.push(`% X Ticks`);
  for (const t of xTicks) {
    lines.push(`\\draw[line width=1pt] (${t.value},-0.12) -- (${t.value},0.12);`);
    if (t.value !== "0") lines.push(`\\node[below, scale=1.5] at (${t.value},0) {$${t.label}$};`);
  }

  lines.push(`% Y Ticks`);
  for (const t of yTicks) {
    lines.push(`\\draw[line width=1pt] (-0.12,${t.value}) -- (0.12,${t.value});`);
    if (t.value !== "0") lines.push(`\\node[left, scale=1.5] at (0,${t.value}) {$${t.label}$};`);
  }

  if (zeroTick) lines.push(`\\node[below left, scale=1.5] at (0,0) {$${zeroTick.label}$};`);

  if (points.length > 0) {
    lines.push(`% Points`);
    for (const p of points) {
      if (p.xLine) lines.push(`\\draw[dotted, line width=1pt] (${p.x},${p.y}) -- (${p.x},0);`);
      if (p.yLine) lines.push(`\\draw[dotted, line width=1pt] (${p.x},${p.y}) -- (0,${p.y});`);
      if (p.pointStyle === "filled") lines.push(`\\fill (${p.x},${p.y}) circle (2.5pt);`);
      else if (p.pointStyle === "hollow") lines.push(`\\draw[line width=1pt, fill=white] (${p.x},${p.y}) circle (2.5pt);`);
      if (p.label) {
        const pos = p.x === 0 && p.y === 0 ? "below left" : `${p.y < 0 ? "below" : "above"} ${p.x < 0 ? "left" : "right"}`;
        lines.push(`\\node[${pos}, scale=1.5] at (${p.x},${p.y}) {$${p.label}$};`);
      }
    }
  }

  return `\\begin{document}\n\n\\begin{tikzpicture}[x=${UNIT_CM}cm,y=${UNIT_CM}cm]\n\n${lines.join("\n")}\n\n\\end{tikzpicture}\n\n\\end{document}`;
}

export default [
  { prefix: "function:", syntaxCheck, compile: (c) => compile(c) },
  { prefix: "function[grid]:", syntaxCheck, compile: (c) => compile(c, true) },
];
