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
  function balancedBrace(s, pos) {
    let depth = 0, i = pos;
    while (i < s.length) {
      if (s[i] === "{") depth++;
      else if (s[i] === "}") { if (--depth === 0) return s.slice(pos + 1, i); }
      i++;
    }
    return null;
  }

  function parseOne(s, i) {
    let min = -defaultExtent, max = defaultExtent, tickStr = undefined;
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] === "[") {
      const end = s.indexOf("]", i);
      if (end !== -1) {
        const [lo, hi] = s.slice(i + 1, end).split(";");
        if (lo && lo.trim()) min = parseFloat(lo);
        if (hi && hi.trim()) max = parseFloat(hi);
        i = end + 1;
      }
    }
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] === "{") tickStr = balancedBrace(s, i);
    return { min, max, tickStr };
  }

  const xIdx = seg.search(/\bx(?=[\s\[{]|$)/);
  const yIdx = seg.search(/\by(?=[\s\[{]|$)/);
  const def = { min: -defaultExtent, max: defaultExtent, tickStr: undefined };
  return {
    x: xIdx !== -1 ? parseOne(seg, xIdx + 1) : def,
    y: yIdx !== -1 ? parseOne(seg, yIdx + 1) : def,
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

function parseOneTransform(s) {
  s = s.trim();
  const num  = `(?:\\d+(?:/\\d+|\\.\\d*)?|\\.\\d+)`;
  const snum = `[+-]?${num}`;
  const ssnum = `[+-]${num}`;
  let m;
  if (s === '|f(x)|') return { type: 'abs' };
  if (s === '-f(x)')  return { type: 'neg' };
  if (s === 'f(-x)')  return { type: 'hflip' };
  m = s.match(new RegExp(`^(${snum})\\*?f\\(x\\)$`));
  if (m) return { type: 'vscale', value: evalNum(m[1]) };
  m = s.match(new RegExp(`^f\\(x\\)(${ssnum})$`));
  if (m) return { type: 'vshift', value: evalNum(m[1]) };
  m = s.match(new RegExp(`^f\\(x(${ssnum})\\)$`));
  if (m) return { type: 'hshift', value: evalNum(m[1]) };
  m = s.match(new RegExp(`^f\\((${snum})\\*?x\\)$`));
  if (m) return { type: 'hscale', value: evalNum(m[1]) };
  return null;
}

function extractTransforms(line) {
  const parts = line.split('>>');
  const clean = parts[0].trim();
  if (parts.length === 1) return { clean, transforms: [], postRanges: {} };
  // Peel trailing x[...] y[...] ranges from the last transform part (post-transform = screen coords)
  const last = parts[parts.length - 1];
  const rangesM = last.match(RANGES_RE);
  const postRanges = rangesM ? parseRanges(rangesM, 1) : {};
  const cleanLast = last.slice(0, last.length - (rangesM ? rangesM[0].length : 0));
  const trParts = [...parts.slice(1, -1), cleanLast];
  return { clean, transforms: trParts.map(parseOneTransform).filter(Boolean), postRanges };
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

function parseCubicLine(line) {
  const m = line.match(new RegExp(`^graph\\s+cubic(?:\\s+(.*?))?${RANGES_RE.source}$`));
  if (!m) return null;
  const body = m[1] ?? "";
  return {
    cubic: true,
    a: body.match(/\ba=([^\s]+)/) ? evalNum(body.match(/\ba=([^\s]+)/)[1]) : 1,
    b: body.match(/\bb=([^\s]+)/) ? evalNum(body.match(/\bb=([^\s]+)/)[1]) : 0,
    c: body.match(/\bc=([^\s]+)/) ? evalNum(body.match(/\bc=([^\s]+)/)[1]) : 0,
    d: body.match(/\bd=([^\s]+)/) ? evalNum(body.match(/\bd=([^\s]+)/)[1]) : 0,
    ...parseRanges(m, 2),
  };
}

function parseSqrtLine(line) {
  const m = line.match(new RegExp(`^graph\\s+sqrt${RANGES_RE.source}$`));
  if (!m) return null;
  return { sqrt: true, ...parseRanges(m, 1) };
}

function parseCbrtLine(line) {
  const m = line.match(new RegExp(`^graph\\s+cbrt${RANGES_RE.source}$`));
  if (!m) return null;
  return { cbrt: true, ...parseRanges(m, 1) };
}

function parseLogLine(line) {
  const m = line.match(new RegExp(`^graph\\s+log(?:\\s+a=([^\\s]+))?${RANGES_RE.source}$`));
  if (!m) return null;
  const a = m[1] ? evalNum(m[1]) : 2;
  if (isNaN(a) || a <= 0 || a === 1) return null;
  return { log: true, a, ...parseRanges(m, 2) };
}

function parseExpLine(line) {
  const m = line.match(new RegExp(`^graph\\s+exp(?:\\s+a=([^\\s]+))?${RANGES_RE.source}$`));
  if (!m) return null;
  const a = m[1] ? evalNum(m[1]) : 2;
  if (isNaN(a) || a <= 0 || a === 1) return null;
  return { exp: true, a, ...parseRanges(m, 2) };
}

function parseTrigLine(line) {
  const m = line.match(new RegExp(`^graph\\s+(sin|cos|tan|tg|cot|ctg)${RANGES_RE.source}$`));
  if (!m) return null;
  const raw = m[1];
  const fn = raw === "tg" ? "tan" : raw === "ctg" ? "cot" : raw;
  return { trig: fn, ...parseRanges(m, 2) };
}



function parseGenericLine(line) {
  const baseMatch = line.match(new RegExp(`^graph\\s+generic(\\[smooth\\])?\\s+(.*?)${RANGES_RE.source}$`));
  if (!baseMatch) return null;
  const smooth = !!baseMatch[1];
  const body = baseMatch[2].trim();
  const ranges = parseRanges(baseMatch, 3);
  const points = [];
  const re = /([v^])?\(([^;]+);([^)]+)\)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const x = evalNum(m[2].trim()), y = evalNum(m[3].trim());
    if (isNaN(x) || isNaN(y)) return null;
    points.push({ x, y, vertex: m[1] === "v" || m[1] === "^", vtype: m[1] ?? null });
  }
  if (points.length < 1) return null;
  return { generic: true, smooth, points, ...ranges };
}

function parseCircleLine(line) {
  if (!/^graph\s+circle\b/.test(line)) return null;
  const cm = line.match(/(?<![a-zA-Z])\(([^;]+);([^)]+)\)/);
  const rm = line.match(/\br=([^\s]+)/);
  const cx = cm ? evalNum(cm[1]) : 0;
  const cy = cm ? evalNum(cm[2]) : 0;
  const r  = rm ? evalNum(rm[1]) : 2;
  if (isNaN(cx) || isNaN(cy) || isNaN(r) || r <= 0) return null;
  return { circle: true, cx, cy, r };
}

function parseHyperbolaLine(line) {
  const baseMatch = line.match(new RegExp(`^graph\\s+hyperbola\\s+(.*?)${RANGES_RE.source}$`));
  if (!baseMatch) return null;

  const body = baseMatch[1].trim();
  const ranges = parseRanges(baseMatch, 2);

  const kMatch = body.match(/\bk=([^\s]+)/);
  if (!kMatch) return null;
  const k = evalNum(kMatch[1]);
  if (isNaN(k) || k === 0) return null;

  return { hyperbola: true, k, ...ranges };
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
      parseGraphLine, parseParabolaLine, parseHyperbolaLine,
      parseCubicLine, parseSqrtLine, parseCbrtLine,
      parseLogLine, parseExpLine, parseTrigLine,
      parseCircleLine, parseGenericLine,
    ].flatMap(fn => segments.map(seg => {
      const { clean, transforms, postRanges } = extractTransforms(seg);
      const g = fn(clean);
      return g ? { ...g, transforms, postRanges } : null;
    }).filter(Boolean)),
  };
}

function syntaxCheck(content, defaultExtent = 3) {
  if (/\baxis\b/.test(content))
    return { valid: false, errors: ['Use "axes" not "axis"'] };
  if (/\bgraph\s+circle\b.*[a-zA-Z]\(/.test(content))
    return { valid: false, errors: ['Circle center must be "(x;y)" with no letter before the parenthesis'] };
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

  const fn = (v) => parseFloat(v.toFixed(6)).toString();
  const applyXTr = (x, tr) => { for (const t of tr) { if (t.type==='hshift') x+=t.value; else if (t.type==='hscale') x*=t.value; else if (t.type==='hflip') x=-x; } return x; };
  const invXTr  = (x, tr) => { for (let i=tr.length-1;i>=0;i--) { const t=tr[i]; if (t.type==='hshift') x-=t.value; else if (t.type==='hscale'&&t.value!==0) x/=t.value; else if (t.type==='hflip') x=-x; } return x; };
  const applyYTr = (y, tr) => { for (const t of tr) { if (t.type==='vshift') y+=t.value; else if (t.type==='vscale') y*=t.value; else if (t.type==='neg') y=-y; else if (t.type==='abs') y=Math.abs(y); } return y; };
  const trExpr = (expr, tr) => {
    if (!tr || !tr.length) return expr;
    let xSub = '\\x';
    for (const t of tr) {
      if (t.type==='hshift') xSub=`(${xSub}+(${fn(t.value)}))`;
      else if (t.type==='hscale') xSub=`((${fn(t.value)})*(${xSub}))`;
      else if (t.type==='hflip') xSub=`(-(${xSub}))`;
    }
    let y = xSub==='\\x' ? expr : expr.split('\\x').join(xSub);
    for (const t of tr) {
      if (t.type==='vshift') y=`(${y}+(${fn(t.value)}))`;
      else if (t.type==='vscale') y=`((${fn(t.value)})*(${y}))`;
      else if (t.type==='neg') y=`(-(${y}))`;
      else if (t.type==='abs') y=`abs(${y})`;
    }
    return y;
  };

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
      const tr = g.transforms || [];
      const pr = g.postRanges || {};
      const f = (n) => parseFloat(n.toFixed(6));
      // x[a;b] before >> = pre-transform domain → convert to screen coords via invXTr
      // x[a;b] after  >> = post-transform screen coords → use directly
      const xLoEff = pr.xFrom ?? (g.xFrom != null ? invXTr(g.xFrom, tr) : null);
      const xHiEff = pr.xTo   ?? (g.xTo   != null ? invXTr(g.xTo,   tr) : null);
      const yLoEff = pr.yFrom ?? g.yFrom ?? null;
      const yHiEff = pr.yTo   ?? g.yTo   ?? null;
      const domX = () => [xLoEff != null && xHiEff != null
        ? [Math.min(xLoEff, xHiEff), Math.max(xLoEff, xHiEff)]
        : [xLoEff ?? xStart, xHiEff ?? xEnd]][0];

      if (g.vertical) {
        const x = applyXTr(g.x, tr);
        const yA = applyYTr(g.yFrom ?? yStart, tr);
        const yB = applyYTr(g.yTo   ?? yEnd,   tr);
        lines.push(`\\draw[thick] (${f(x)},${f(Math.min(yA,yB))}) -- (${f(x)},${f(Math.max(yA,yB))});`);
        continue;
      }

      if (g.parabola) {
        let [xLo, xHi] = domX();
        if (!tr.length) {
          const yLo = g.yFrom ?? yStart, yHi = g.yTo ?? yEnd;
          const solveY = (yB) => { const d=g.b*g.b-4*g.a*(g.c-yB); if(d<0)return null; const sq=Math.sqrt(d); return [(-g.b-sq)/(2*g.a),(-g.b+sq)/(2*g.a)].sort((u,v)=>u-v); };
          const cr = g.a>0?solveY(yHi):solveY(yLo);
          if (cr) { xLo=Math.max(xLo,cr[0]); xHi=Math.min(xHi,cr[1]); }
        }
        if (xLo >= xHi) continue;
        const base = `(${f(g.a)}*\\x + ${f(g.b)})*\\x + ${f(g.c)}`;
        lines.push(`\\draw[thick] plot[domain=${f(xLo)}:${f(xHi)}, samples=60, smooth] (\\x, {${trExpr(base,tr)}});`);
        continue;
      }

      if (g.cubic) {
        const [xLo, xHi] = domX();
        const coeffs = [{c:g.d,j:0},{c:g.c,j:1},{c:g.b,j:2},{c:g.a,j:3}].filter(t=>Math.abs(t.c)>1e-9);
        const base = coeffs.length===0 ? "0"
          : coeffs.map(({c,j},i)=>{ const cs=f(c); const term=j===0?`${cs}`:j===1?`${cs}*\\x`:`${cs}*\\x^${j}`; return i===0?term:(c>=0?"+":"")+term; }).join("");
        lines.push(`\\draw[thick] plot[domain=${f(xLo)}:${f(xHi)}, samples=60, smooth] (\\x, {${trExpr(base,tr)}});`);
        continue;
      }

      if (g.hyperbola) {
        const eps = 0.01;
        const [xLo, xHi] = domX();
        const singScreen = invXTr(0, tr); // where the asymptote is in screen coords
        const base = `${f(g.k)}/\\x`;
        const drawHBranch = (lo, hi) => {
          if (lo < hi) lines.push(`\\draw[thick] plot[domain=${f(lo)}:${f(hi)}, samples=80, smooth] (\\x, {${trExpr(base,tr)}});`);
        };
        if (singScreen > xLo && singScreen < xHi) {
          drawHBranch(xLo, singScreen - eps);
          drawHBranch(singScreen + eps, xHi);
        } else {
          drawHBranch(xLo, xHi);
        }
        continue;
      }

      if (g.trig) {
        const [xLo, xHi] = domX();
        const drawBranches = (baseExpr, isAsymptote) => {
          const expr = trExpr(baseExpr, tr);
          const eps = 0.04;
          const fLo = applyXTr(xLo, tr), fHi = applyXTr(xHi, tr);
          const fMin = Math.min(fLo, fHi), fMax = Math.max(fLo, fHi);
          const asyms = [];
          for (let n = Math.floor(fMin)-2; n <= Math.ceil(fMax)+2; n++)
            if (isAsymptote(n)) { const sx=invXTr(n,tr); if(sx>xLo&&sx<xHi) asyms.push(sx); }
          asyms.sort((a,b)=>a-b);
          for (const a of asyms)
            lines.push(`\\draw[darkgray, dashed, line width=0.8pt] (${f(a)},${f(yStart)}) -- (${f(a)},${f(yEnd)});`);
          let prev = xLo;
          for (const a of asyms) {
            if (a-eps<=prev){prev=Math.max(prev,a+eps);continue;}
            const hi=Math.min(a-eps,xHi);
            if(prev<hi) lines.push(`\\draw[thick] plot[domain=${f(prev)}:${f(hi)}, samples=60, smooth] (\\x, {${expr}});`);
            prev=a+eps;
          }
          if (prev<xHi) lines.push(`\\draw[thick] plot[domain=${f(prev)}:${f(xHi)}, samples=60, smooth] (\\x, {${expr}});`);
        };
        const sinExpr = trExpr("sin(\\x * 90)", tr);
        const cosExpr = trExpr("cos(\\x * 90)", tr);
        if (g.trig==="sin")      lines.push(`\\draw[thick] plot[domain=${f(xLo)}:${f(xHi)}, samples=100, smooth] (\\x, {${sinExpr}});`);
        else if (g.trig==="cos") lines.push(`\\draw[thick] plot[domain=${f(xLo)}:${f(xHi)}, samples=100, smooth] (\\x, {${cosExpr}});`);
        else if (g.trig==="tan") drawBranches("tan(\\x * 90)", n=>n%2!==0);
        else if (g.trig==="cot") drawBranches("cos(\\x * 90) / sin(\\x * 90)", n=>n%2===0);
        continue;
      }

      if (g.generic) {
        const rawPts = [...g.points].sort((a,b)=>a.x-b.x);
        const pts = rawPts.map(p => ({ ...p, x: applyXTr(p.x, tr), y: applyYTr(p.y, tr) }));
        const np = pts.length;
        if (np < 2) continue;
        const fv = (v) => parseFloat(v.toFixed(4));
        if (!g.smooth) {
          lines.push(`\\draw[thick] ${pts.map(p=>`(${fv(p.x)},${fv(p.y)})`).join(" -- ")};`);
        } else {
          const slopes = pts.map((pt,i) => {
            if (pt.vertex) return 0;
            if (i===0) return (pts[1].y-pts[0].y)/(pts[1].x-pts[0].x);
            if (i===np-1) return (pts[np-1].y-pts[np-2].y)/(pts[np-1].x-pts[np-2].x);
            return (pts[i+1].y-pts[i-1].y)/(pts[i+1].x-pts[i-1].x);
          });
          let path = `(${fv(pts[0].x)},${fv(pts[0].y)})`;
          for (let i=0;i<np-1;i++) {
            const x0=pts[i].x,y0=pts[i].y,m0=slopes[i];
            const x1=pts[i+1].x,y1=pts[i+1].y,m1=slopes[i+1];
            const dx=x1-x0;
            path+=` .. controls (${fv(x0+dx/3)},${fv(y0+dx*m0/3)}) and (${fv(x1-dx/3)},${fv(y1-dx*m1/3)}) .. (${fv(x1)},${fv(y1)})`;
          }
          lines.push(`\\draw[thick] ${path};`);
        }
        continue;
      }

      if (g.circle) {
        lines.push(`\\draw[thick] (${f(g.cx)},${f(g.cy)}) circle (${f(g.r)});`);
        continue;
      }

      if (g.sqrt) {
        const [rawSqrtLo, rawSqrtHi] = domX();
        const lo = Math.max(rawSqrtLo, 0), hi = rawSqrtHi;
        if (lo < hi) lines.push(`\\draw[thick] plot[domain=${f(lo)}:${f(hi)}, samples=60, smooth] (\\x, {${trExpr("sqrt(\\x)",tr)}});`);
        continue;
      }

      if (g.cbrt) {
        const [xLo, xHi] = domX();
        if (xLo < 0) { const hi=Math.min(xHi,0); if(xLo<=hi) lines.push(`\\draw[thick] plot[domain=${f(xLo)}:${f(hi)}, samples=60, smooth] (\\x, {${trExpr("-((-\\x)^(1/3))",tr)}});`); }
        if (xHi > 0) { const lo=Math.max(xLo,0); if(lo<=xHi) lines.push(`\\draw[thick] plot[domain=${f(lo)}:${f(xHi)}, samples=60, smooth] (\\x, {${trExpr("\\x^(1/3)",tr)}});`); }
        continue;
      }

      if (g.log) {
        const [rawLogLo, rawLogHi] = domX();
        const logEps=0.01, lo=Math.max(rawLogLo, logEps), hi=rawLogHi;
        if (lo<hi) lines.push(`\\draw[thick] plot[domain=${f(lo)}:${f(hi)}, samples=60, smooth] (\\x, {${trExpr(`ln(\\x)/ln(${f(g.a)})`,tr)}});`);
        continue;
      }

      if (g.exp) {
        const [lo, hi] = domX();
        lines.push(`\\draw[thick] plot[domain=${f(lo)}:${f(hi)}, samples=60, smooth] (\\x, {${trExpr(`exp(\\x*ln(${f(g.a)}))`,tr)}});`);
        continue;
      }

      // linear line fallthrough
      {
        let [xLo, xHi] = domX();
        const yLo = g.yFrom ?? yStart, yHi = g.yTo ?? yEnd;
        if (g.m !== 0) {
          const xAtYLo = (yLo-g.b)/g.m, xAtYHi = (yHi-g.b)/g.m;
          xLo = Math.max(xLo, Math.min(xAtYLo,xAtYHi));
          xHi = Math.min(xHi, Math.max(xAtYLo,xAtYHi));
        } else { if (g.b<yLo||g.b>yHi) continue; }
        if (xLo>=xHi) continue;
        const base = `${f(g.m)}*\\x+(${f(g.b)})`;
        const expr = trExpr(base, tr);
        lines.push(`\\draw[thick] plot[domain=${f(xLo)}:${f(xHi)}, samples=2] (\\x, {${expr}});`);
      }
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
