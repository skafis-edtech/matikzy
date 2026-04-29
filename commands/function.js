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

function evalNum(s) {
  if (!s || s === "+") return 1;
  if (s === "-") return -1;
  const sign = s[0] === "-" ? -1 : 1;
  const abs = s.replace(/^[+-]/, "");
  const slash = abs.indexOf("/");
  return slash !== -1
    ? sign * parseFloat(abs.slice(0, slash)) / parseFloat(abs.slice(slash + 1))
    : parseFloat(s);
}

function parseLinearExpr(expr) {
  const s = expr.replace(/\s+/g, "");
  const N = `\\d+(?:/\\d+|\\.\\d*)?`;
  const mxMatch = s.match(new RegExp(`^([+-]?(?:${N})?)x([+-](?:${N}))?$`));
  if (mxMatch) {
    return { m: evalNum(mxMatch[1] || "1"), b: mxMatch[2] ? evalNum(mxMatch[2]) : 0 };
  }
  const cMatch = s.match(new RegExp(`^([+-]?${N})$`));
  if (cMatch) return { m: 0, b: evalNum(cMatch[1]) };
  return null;
}

const RANGES_RE = /(?:\s+x\[([^;]+);([^\]]+)\])?(?:\s+y\[([^;]+);([^\]]+)\])?$/;

function parseRanges(m, offset) {
  return {
    xFrom: m[offset]     != null ? parseFloat(m[offset])     : null,
    xTo:   m[offset + 1] != null ? parseFloat(m[offset + 1]) : null,
    yFrom: m[offset + 2] != null ? parseFloat(m[offset + 2]) : null,
    yTo:   m[offset + 3] != null ? parseFloat(m[offset + 3]) : null,
  };
}

function parseGraphLine(line) {
  // Form 1: y=mx+b
  const eqMatch = line.match(new RegExp(`^graph\\s+line\\s+y=([^\\s]+)${RANGES_RE.source}`));
  if (eqMatch) {
    const expr = parseLinearExpr(eqMatch[1]);
    if (expr) return { m: expr.m, b: expr.b, ...parseRanges(eqMatch, 2) };
  }

  // Form 2: two points (x1;y1) (x2;y2)
  const ptMatch = line.match(new RegExp(`^graph\\s+line\\s+\\(([^;]+);([^)]+)\\)\\s+\\(([^;]+);([^)]+)\\)${RANGES_RE.source}`));
  if (ptMatch) {
    const x1 = parseFloat(ptMatch[1]), y1 = parseFloat(ptMatch[2]);
    const x2 = parseFloat(ptMatch[3]), y2 = parseFloat(ptMatch[4]);
    if (x1 === x2) return null;
    const slope = (y2 - y1) / (x2 - x1);
    return { m: slope, b: y1 - slope * x1, ...parseRanges(ptMatch, 5) };
  }

  // Form 3: x=c (vertical line, c may be a fraction)
  const vMatch = line.match(new RegExp(`^graph\\s+line\\s+x=([^\\s]+)${RANGES_RE.source}`));
  if (vMatch) {
    const x = evalNum(vMatch[1]);
    if (!isNaN(x)) return { vertical: true, x, ...parseRanges(vMatch, 2) };
  }

  return null;
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
    graphs: lines.map(parseGraphLine).filter(Boolean),
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
  const { xMin, xMax, xTicks, yMin, yMax, yTicks, points, graphs } = parseContent(
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

  if (graphs.length > 0) {
    lines.push(`% Graphs`);
    for (const g of graphs) {
      if (g.vertical) {
        const yLo = g.yFrom ?? yStart;
        const yHi = g.yTo   ?? yEnd;
        lines.push(`\\draw[thick] (${g.x},${yLo}) -- (${g.x},${yHi});`);
        continue;
      }

      let xLo = g.xFrom ?? xStart;
      let xHi = g.xTo   ?? xEnd;
      const yLo = g.yFrom ?? yStart;
      const yHi = g.yTo   ?? yEnd;

      if (g.m !== 0) {
        const xAtYLo = (yLo - g.b) / g.m;
        const xAtYHi = (yHi - g.b) / g.m;
        xLo = Math.max(xLo, Math.min(xAtYLo, xAtYHi));
        xHi = Math.min(xHi, Math.max(xAtYLo, xAtYHi));
      } else {
        if (g.b < yLo || g.b > yHi) continue;
      }

      if (xLo >= xHi) continue;
      const y1 = parseFloat((g.m * xLo + g.b).toFixed(6));
      const y2 = parseFloat((g.m * xHi + g.b).toFixed(6));
      lines.push(`\\draw[thick] (${xLo},${y1}) -- (${xHi},${y2});`);
    }
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
