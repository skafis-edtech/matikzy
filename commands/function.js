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

function parseAxesSeg(seg, defaultExtent) {
  const parseOne = (m) => ({
    min: m[1] != null && m[1] !== "" ? parseFloat(m[1]) : -defaultExtent,
    max: m[2] != null && m[2] !== "" ? parseFloat(m[2]) : defaultExtent,
    tickStr: m[3],
  });
  const xm = seg.match(/\bx(?:\[([^;]*);([^\]]*)\])?(?:\s*\{([^}]*)\})?/);
  const ym = seg.match(/\by(?:\[([^;]*);([^\]]*)\])?(?:\s*\{([^}]*)\})?/);
  return {
    x: xm ? parseOne(xm) : { min: -defaultExtent, max: defaultExtent, tickStr: undefined },
    y: ym ? parseOne(ym) : { min: -defaultExtent, max: defaultExtent, tickStr: undefined },
  };
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

const RANGES_RE = /(?:\s+x\[([^;]*);([^\]]*)\])?(?:\s+y\[([^;]*);([^\]]*)\])?$/;

function parseRanges(m, offset) {
  const p = (s) => (s != null && s !== "") ? parseFloat(s) : null;
  return { xFrom: p(m[offset]), xTo: p(m[offset + 1]), yFrom: p(m[offset + 2]), yTo: p(m[offset + 3]) };
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

function parseParabolaLine(line) {
  const baseMatch = line.match(new RegExp(`^graph\\s+parabola\\s+(.*?)${RANGES_RE.source}$`));
  if (!baseMatch) return null;

  const body = baseMatch[1].trim();
  const ranges = parseRanges(baseMatch, 2);

  const aMatch = body.match(/\ba=([^\s]+)/);
  if (!aMatch) return null;
  const a = evalNum(aMatch[1]);
  if (isNaN(a) || a === 0) return null;

  // Factored form: x{r1;r2}
  const factMatch = body.match(/\bx\{([^;]+);([^}]+)\}/);
  if (factMatch) {
    const r1 = evalNum(factMatch[1].trim()), r2 = evalNum(factMatch[2].trim());
    if (isNaN(r1) || isNaN(r2)) return null;
    return { parabola: true, a, b: -a*(r1+r2), c: a*r1*r2, ...ranges };
  }

  // Vertex form: v(h;k)
  const vertMatch = body.match(/\bv\(([^;]+);([^)]+)\)/);
  if (vertMatch) {
    const h = evalNum(vertMatch[1].trim()), k = evalNum(vertMatch[2].trim());
    if (isNaN(h) || isNaN(k)) return null;
    return { parabola: true, a, b: -2*a*h, c: a*h*h+k, ...ranges };
  }

  // Standard form: a=n b=n c=n
  const bMatch = body.match(/\bb=([^\s]+)/);
  const cMatch = body.match(/\bc=([^\s]+)/);
  const b = bMatch ? evalNum(bMatch[1]) : 0;
  const c = cMatch ? evalNum(cMatch[1]) : 0;
  if (isNaN(b) || isNaN(c)) return null;
  return { parabola: true, a, b, c, ...ranges };
}

function parseContent(content, defaultExtent = 3) {
  const segments = content
    .split(/\s+(?=axes\b|graph\b|point\b)/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const axesSeg = segments.find((s) => s.startsWith("axes"));
  const { x: xParsed, y: yParsed } = parseAxesSeg(axesSeg ?? "axes", defaultExtent);
  return {
    xMin: xParsed.min, xMax: xParsed.max, xTicks: parseTicks(xParsed.tickStr, xParsed.min, xParsed.max),
    yMin: yParsed.min, yMax: yParsed.max, yTicks: parseTicks(yParsed.tickStr, yParsed.min, yParsed.max),
    points: segments.map(parsePointLine).filter(Boolean),
    graphs: [
      ...segments.map(parseGraphLine).filter(Boolean),
      ...segments.map(parseParabolaLine).filter(Boolean),
    ],
  };
}

function syntaxCheck(content, defaultExtent = 3) {
  if (/\baxis\b/.test(content))
    return { valid: false, errors: ['Use "axes" not "axis"'] };
  const p = parseContent(content.trim(), defaultExtent);
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

function compile(content, grid = false, defaultExtent = 3, tikzScale = 1) {
  const { xMin, xMax, xTicks, yMin, yMax, yTicks, points, graphs } = parseContent(
    content.trim(), defaultExtent,
  );

  const ext      = EXT;
  const arrowLen = 0.2 / tikzScale;
  const arrowWid = 0.1 / tikzScale;
  const tickH    = 0.12;

  const xStart = xMin - ext;
  const xEnd = xMax + ext;
  const yStart = yMin - ext;
  const yEnd = yMax + ext;

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
    lines.push(`\\begin{scope}`);
    lines.push(`\\clip (${xStart},${yStart}) rectangle (${xEnd},${yEnd});`);
    for (const g of graphs) {
      if (g.vertical) {
        const yLo = g.yFrom ?? yStart;
        const yHi = g.yTo   ?? yEnd;
        lines.push(`\\draw[thick] (${g.x},${yLo}) -- (${g.x},${yHi});`);
        continue;
      }

      if (g.parabola) {
        let xLo = g.xFrom ?? xStart;
        let xHi = g.xTo   ?? xEnd;
        const yLo = g.yFrom ?? yStart;
        const yHi = g.yTo   ?? yEnd;
        // Clip by the y-bound that can shrink the domain (upper for ∪, lower for ∩)
        const solveY = (yB) => {
          const d = g.b*g.b - 4*g.a*(g.c - yB);
          if (d < 0) return null;
          const sq = Math.sqrt(d);
          return [(-g.b - sq)/(2*g.a), (-g.b + sq)/(2*g.a)].sort((u,v) => u-v);
        };
        const clipRoots = g.a > 0 ? solveY(yHi) : solveY(yLo);
        if (clipRoots) {
          xLo = Math.max(xLo, clipRoots[0]);
          xHi = Math.min(xHi, clipRoots[1]);
        }
        if (xLo >= xHi) continue;
        const f = (n) => parseFloat(n.toFixed(6));
        const expr = `{(${f(g.a)}*\\x + ${f(g.b)})*\\x + ${f(g.c)}}`;
        lines.push(`\\draw[thick] plot[domain=${f(xLo)}:${f(xHi)}, samples=60, smooth] (\\x, ${expr});`);
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
    lines.push(`\\end{scope}`);
  }

  lines.push(`% X Axis`);
  lines.push(`\\draw[line width=1pt] (${xStart},0) -- (${xEnd},0);`);
  lines.push(`\\fill (${xEnd},0) -- (${xEnd - arrowLen},${arrowWid}) -- (${xEnd - arrowLen},${-arrowWid}) -- cycle;`);
  lines.push(`\\node[below, scale=1.5] at (${xEnd - arrowWid},0) {$x$};`);

  lines.push(`% Y Axis`);
  lines.push(`\\draw[line width=1pt] (0,${yStart}) -- (0,${yEnd});`);
  lines.push(`\\fill (0,${yEnd}) -- (${-arrowWid},${yEnd - arrowLen}) -- (${arrowWid},${yEnd - arrowLen}) -- cycle;`);
  lines.push(`\\node[left, scale=1.5] at (0,${yEnd - arrowWid}) {$y$};`);

  const zeroXTick = xTicks.find((t) => t.value === "0");
  const zeroYTick = yTicks.find((t) => t.value === "0");
  const zeroTick = zeroXTick ?? zeroYTick;

  lines.push(`% X Ticks`);
  for (const t of xTicks) {
    lines.push(`\\draw[line width=1pt] (${t.value},${-tickH}) -- (${t.value},${tickH});`);
    if (t.value !== "0") lines.push(`\\node[below, scale=1.5] at (${t.value},0) {$${t.label}$};`);
  }

  lines.push(`% Y Ticks`);
  for (const t of yTicks) {
    lines.push(`\\draw[line width=1pt] (${-tickH},${t.value}) -- (${tickH},${t.value});`);
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

  const scaleOpt = tikzScale !== 1 ? `, scale=${tikzScale}` : "";
  return `\\begin{document}\n\n\\begin{tikzpicture}[x=${UNIT_CM}cm,y=${UNIT_CM}cm${scaleOpt}]\n\n${lines.join("\n")}\n\n\\end{tikzpicture}\n\n\\end{document}`;
}

export default [
  { prefix: "function:",         syntaxCheck,                          compile: (c) => compile(c) },
  { prefix: "function[grid]:",   syntaxCheck,                          compile: (c) => compile(c, true) },
  { prefix: "function[small]:",       syntaxCheck, compile: (c) => compile(c, false, 3, 1/3) },
  { prefix: "function[small][grid]:", syntaxCheck, compile: (c) => compile(c, true,  3, 1/3) },
];
