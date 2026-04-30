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

function gaussianElim(mat) {
  const n = mat.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(mat[row][col]) > Math.abs(mat[pivot][col])) pivot = row;
    [mat[col], mat[pivot]] = [mat[pivot], mat[col]];
    if (Math.abs(mat[col][col]) < 1e-12) return null;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = mat[row][col] / mat[col][col];
      for (let k = col; k <= n; k++) mat[row][k] -= f * mat[col][k];
    }
  }
  return mat.map((row, i) => row[n] / row[i]);
}

function parsePoints(body, count) {
  const re = /\(([^;]+);([^)]+)\)/g;
  const pts = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    const x = evalNum(m[1].trim()), y = evalNum(m[2].trim());
    if (isNaN(x) || isNaN(y)) return null;
    pts.push([x, y]);
  }
  return pts.length === count ? pts : null;
}

function parseParabolaLine(line) {
  const baseMatch = line.match(new RegExp(`^graph\\s+parabola(?:\\s+(.*?))?${RANGES_RE.source}$`));
  if (!baseMatch) return null;

  const body = (baseMatch[1] ?? "").trim();
  const ranges = parseRanges(baseMatch, 2);

  if (!body) return { parabola: true, a: 1, b: 0, c: 0, ...ranges };

  const N = `\\d+(?:/\\d+|\\.\\d*)?|\\.\\d+`;
  const C = `[+-]?(?:${N})?`;  // optional leading coefficient (empty → 1)
  const S = `[+-](?:${N})?`;   // explicitly-signed term

  // 3-point form: (x1;y1) (x2;y2) (x3;y3)
  if (/^\(/.test(body)) {
    const pts = parsePoints(body, 3);
    if (!pts) return null;
    const mat = pts.map(([x, y]) => [x*x, x, 1, y]);
    const coeffs = gaussianElim(mat);
    if (!coeffs) return null;
    return { parabola: true, a: coeffs[0], b: coeffs[1], c: coeffs[2], ...ranges };
  }

  if (!body.startsWith('y=')) return null;
  const expr = body.slice(2);
  let m;

  // Vertex form: y=a(x±off)^2±n
  const vRe = new RegExp(`^(${C})\\(x(${S})\\)\\^2(${S})?$`);
  if ((m = expr.match(vRe))) {
    const a = evalNum(m[1]), h = -evalNum(m[2]), n = m[3] ? evalNum(m[3]) : 0;
    if (isNaN(a) || a === 0 || isNaN(h) || isNaN(n)) return null;
    return { parabola: true, a, b: -2*a*h, c: a*h*h+n, ...ranges };
  }

  // Factored form: y=a(x±r1)(x±r2)
  const fRe = new RegExp(`^(${C})\\(x(${S})\\)\\(x(${S})\\)$`);
  if ((m = expr.match(fRe))) {
    const a = evalNum(m[1]), r1 = -evalNum(m[2]), r2 = -evalNum(m[3]);
    if (isNaN(a) || a === 0 || isNaN(r1) || isNaN(r2)) return null;
    return { parabola: true, a, b: -a*(r1+r2), c: a*r1*r2, ...ranges };
  }

  // Standard form: y=ax^2±bx±c
  const stdRe = new RegExp(`^(${C})x\\^2(?:(${S})x)?(${S})?$`);
  if ((m = expr.match(stdRe))) {
    const a = evalNum(m[1]), b = m[2] ? evalNum(m[2]) : 0, c = m[3] ? evalNum(m[3]) : 0;
    if (isNaN(a) || a === 0 || isNaN(b) || isNaN(c)) return null;
    return { parabola: true, a, b, c, ...ranges };
  }

  return null;
}

function parseCubicLine(line) {
  const baseMatch = line.match(new RegExp(`^graph\\s+cubic(?:\\s+(.*?))?${RANGES_RE.source}$`));
  if (!baseMatch) return null;

  const body = (baseMatch[1] ?? "").trim();
  const ranges = parseRanges(baseMatch, 2);

  const N = `\\d+(?:/\\d+|\\.\\d*)?|\\.\\d+`;
  const C = `[+-]?(?:${N})?`;
  const S = `[+-](?:${N})?`;

  // 4-point form: (x1;y1) (x2;y2) (x3;y3) (x4;y4)
  if (/^\(/.test(body)) {
    const pts = parsePoints(body, 4);
    if (!pts) return null;
    const mat = pts.map(([x, y]) => [x*x*x, x*x, x, 1, y]);
    const coeffs = gaussianElim(mat);
    if (!coeffs) return null;
    return { cubic: true, a: coeffs[0], b: coeffs[1], c: coeffs[2], d: coeffs[3], ...ranges };
  }

  // Standard form: y=ax^3±bx^2±cx±d
  if (body.startsWith('y=')) {
    const expr = body.slice(2);
    const stdRe = new RegExp(`^(${C})x\\^3(?:(${S})x\\^2)?(?:(${S})x)?(${S})?$`);
    const m = expr.match(stdRe);
    if (!m) return null;
    const a = evalNum(m[1]), b = m[2] ? evalNum(m[2]) : 0;
    const c = m[3] ? evalNum(m[3]) : 0, d = m[4] ? evalNum(m[4]) : 0;
    if (isNaN(a) || a === 0 || isNaN(b) || isNaN(c) || isNaN(d)) return null;
    return { cubic: true, a, b, c, d, ...ranges };
  }

  // bare "graph cubic" → x^3
  if (!body) return { cubic: true, a: 1, b: 0, c: 0, d: 0, ...ranges };

  return null;
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

function parseAreaLine(line) {
  const m = line.match(/^area\s+\(([^;]+);([^)]+)\)\s*(.*?)\s*$/);
  if (!m) return null;
  const x = parseFloat(m[1]), y = parseFloat(m[2]);
  if (isNaN(x) || isNaN(y)) return null;
  return { area: true, x, y, label: m[3].trim() };
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
    .split(/\s+(?=axes\b|graph\b|point\b|area\b)/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const axesSeg = segments.find((s) => s.startsWith("axes"));
  const { x: xParsed, y: yParsed } = parseAxesSeg(axesSeg ?? "axes", defaultExtent);
  return {
    xMin: xParsed.min, xMax: xParsed.max, xTicks: parseTicks(xParsed.tickStr, xParsed.min, xParsed.max),
    yMin: yParsed.min, yMax: yParsed.max, yTicks: parseTicks(yParsed.tickStr, yParsed.min, yParsed.max),
    points: segments.map(parsePointLine).filter(Boolean),
    areas: segments.map(parseAreaLine).filter(Boolean),
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
  const { xMin, xMax, xTicks, yMin, yMax, yTicks, points, graphs, areas } = parseContent(
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

  if (graphs.length > 0 || areas.length > 0) {
    lines.push(`% Graphs`);
    lines.push(`\\begin{scope}`);
    lines.push(`\\clip (${xStart},${yStart}) rectangle (${xEnd},${yEnd});`);

    // Area fills: raster flood-fill, rendered before curves so curves sit on top
    if (areas.length > 0) {
      const GW = 300, GH = 300;
      // Grid bounded by the drawn axes extent (same as the clip rectangle)
      const xToC = (x) => Math.max(0, Math.min(GW-1, Math.round((x-xStart)/(xEnd-xStart)*(GW-1))));
      const yToR = (y) => Math.max(0, Math.min(GH-1, Math.round((y-yStart)/(yEnd-yStart)*(GH-1))));
      const cToX = (c) => xStart + c/(GW-1)*(xEnd-xStart);
      const rToY = (r) => yStart + r/(GH-1)*(yEnd-yStart);
      const cW = (xEnd-xStart)/GW, cH = (yEnd-yStart)/GH;
      const fA = (v) => parseFloat(v.toFixed(4)).toString();

      const wallGrid = new Uint8Array(GW*GH);
      const mark = (c,r) => { if(c>=0&&c<GW&&r>=0&&r<GH) wallGrid[r*GW+c]=1; };
      const bres = (c0,r0,c1,r1) => {
        const dc=Math.abs(c1-c0),dr=Math.abs(r1-r0),sc=c0<c1?1:-1,sr=r0<r1?1:-1;
        let e=dc-dr,c=c0,r=r0;
        for(;;){ mark(c,r); if(c===c1&&r===r1) break; const e2=2*e; if(e2>-dr){e-=dr;c+=sc;} if(e2<dc){e+=dc;r+=sr;} }
      };

      // Boundary walls set 3 pixels inward from the axes edge
      const BM = 3;
      for(let c=0;c<GW;c++) for(let m=0;m<BM;m++){mark(c,m);mark(c,GH-1-m);}
      for(let r=0;r<GH;r++) for(let m=0;m<BM;m++){mark(m,r);mark(GW-1-m,r);}

      // Rasterize all drawn graphs, sampling within axes range
      const SAMP = GW*3;
      for (const g of graphs) {
        const tr = g.transforms||[];
        const inv = (x) => invXTr(x,tr);
        const apY = (y) => applyYTr(y,tr);
        const apX = (x) => applyXTr(x,tr);

        if (g.vertical) {
          const sc=xToC(apX(g.x)); for(let r=0;r<GH;r++) mark(sc,r); continue;
        }
        if (g.circle) {
          let pc=null,pr=null;
          for(let i=0;i<=SAMP;i++){
            const th=2*Math.PI*i/SAMP, c=xToC(g.cx+g.r*Math.cos(th)), r=yToR(g.cy+g.r*Math.sin(th));
            if(pc!==null) bres(pc,pr,c,r); else mark(c,r); pc=c;pr=r;
          }
          continue;
        }

        let evalY=null;
        if(g.parabola)      evalY=(sx)=>{const u=inv(sx);return apY(g.a*u*u+g.b*u+g.c);};
        else if(g.cubic)    evalY=(sx)=>{const u=inv(sx);return apY(((g.a*u+g.b)*u+g.c)*u+g.d);};
        else if(g.trig==='sin') evalY=(sx)=>apY(Math.sin(inv(sx)*Math.PI/2));
        else if(g.trig==='cos') evalY=(sx)=>apY(Math.cos(inv(sx)*Math.PI/2));
        else if(g.trig==='tan') evalY=(sx)=>{const v=Math.tan(inv(sx)*Math.PI/2);return Math.abs(v)>50?null:apY(v);};
        else if(g.trig==='cot') evalY=(sx)=>{const s=Math.sin(inv(sx)*Math.PI/2);return Math.abs(s)<0.01?null:apY(Math.cos(inv(sx)*Math.PI/2)/s);};
        else if(g.sqrt)     evalY=(sx)=>{const u=inv(sx);return u<0?null:apY(Math.sqrt(u));};
        else if(g.cbrt)     evalY=(sx)=>apY(Math.cbrt(inv(sx)));
        else if(g.log)      evalY=(sx)=>{const u=inv(sx);return u<=0?null:apY(Math.log(u)/Math.log(g.a));};
        else if(g.exp)      evalY=(sx)=>apY(Math.pow(g.a,inv(sx)));
        else if(g.hyperbola)evalY=(sx)=>{const u=inv(sx);return Math.abs(u)<0.01?null:apY(g.k/u);};
        else if(g.generic){
          const pts=[...g.points].sort((a,b)=>a.x-b.x).map(p=>({x:apX(p.x),y:apY(p.y)}));
          evalY=(sx)=>{
            if(pts.length<2||sx<pts[0].x||sx>pts[pts.length-1].x) return null;
            for(let i=0;i<pts.length-1;i++) if(sx>=pts[i].x&&sx<=pts[i+1].x){const t=(sx-pts[i].x)/(pts[i+1].x-pts[i].x);return pts[i].y+t*(pts[i+1].y-pts[i].y);}
            return null;
          };
        } else {
          evalY=(sx)=>apY(g.m*inv(sx)+g.b);
        }
        if(!evalY) continue;

        let pc=null,pr=null;
        for(let i=0;i<=SAMP;i++){
          const sx=xStart+(xEnd-xStart)*i/SAMP, sy=evalY(sx);
          if(sy==null||!isFinite(sy)){pc=null;pr=null;continue;}
          const c=xToC(sx), r=yToR(sy);
          if(pc!==null) bres(pc,pr,c,r); else mark(c,r);
          pc=c; pr=r;
        }
      }

      // Per area: BFS then output a single staircase polygon (no opacity, no color mixing)
      for(const ag of areas){
        const grid=wallGrid.slice();
        const sc=xToC(ag.x), sr=yToR(ag.y);
        if(sc<0||sc>=GW||sr<0||sr>=GH||grid[sr*GW+sc]===1) continue;
        const q=new Int32Array(GW*GH); let qH=0,qT=0;
        q[qT++]=sr*GW+sc; grid[sr*GW+sc]=2;
        while(qH<qT){
          const idx=q[qH++], c=idx%GW, r=(idx/GW)|0;
          if(c>0   &&grid[r*GW+c-1]===0){grid[r*GW+c-1]=2;q[qT++]=r*GW+c-1;}
          if(c<GW-1&&grid[r*GW+c+1]===0){grid[r*GW+c+1]=2;q[qT++]=r*GW+c+1;}
          if(r>0   &&grid[(r-1)*GW+c]===0){grid[(r-1)*GW+c]=2;q[qT++]=(r-1)*GW+c;}
          if(r<GH-1&&grid[(r+1)*GW+c]===0){grid[(r+1)*GW+c]=2;q[qT++]=(r+1)*GW+c;}
        }
        // Collect per-row left/right boundaries and centroid
        const lB=new Int32Array(GH).fill(-1), rB=new Int32Array(GH).fill(-1);
        let sumC=0,sumR=0,cnt=0,mnR=GH,mxR=-1;
        for(let r=0;r<GH;r++){
          for(let c=0;c<GW;c++) if(grid[r*GW+c]===2){ if(lB[r]===-1) lB[r]=c; rB[r]=c; }
          if(lB[r]!==-1){
            const span=rB[r]-lB[r]+1;
            sumC+=(lB[r]+rB[r])/2*span; sumR+=r*span; cnt+=span;
            if(r<mnR) mnR=r; if(r>mxR) mxR=r;
          }
        }
        if(mxR<mnR) continue;
        // Build staircase polygon: right side ascending, left side descending
        const pts=[]; let lpx=null,lpy=null;
        const ap=(x,y)=>{const fx=fA(x),fy=fA(y);if(fx!==lpx||fy!==lpy){pts.push(`(${fx},${fy})`);lpx=fx;lpy=fy;}};
        const step=Math.max(1,Math.round((mxR-mnR)/40));
        for(let r=mnR;r<=mxR;r+=step) if(rB[r]!==-1){ ap(cToX(rB[r])+cW/2,rToY(r)-cH/2); ap(cToX(rB[r])+cW/2,rToY(r)+cH/2); }
        if(rB[mxR]!==-1){ ap(cToX(rB[mxR])+cW/2,rToY(mxR)-cH/2); ap(cToX(rB[mxR])+cW/2,rToY(mxR)+cH/2); }
        for(let r=mxR;r>=mnR;r-=step) if(lB[r]!==-1){ ap(cToX(lB[r])-cW/2,rToY(r)+cH/2); ap(cToX(lB[r])-cW/2,rToY(r)-cH/2); }
        if(lB[mnR]!==-1){ ap(cToX(lB[mnR])-cW/2,rToY(mnR)+cH/2); ap(cToX(lB[mnR])-cW/2,rToY(mnR)-cH/2); }
        lines.push(`\\fill[lightgray] ${pts.join(' -- ')} -- cycle;`);
        if(ag.label&&cnt>0)
          lines.push(`\\node[scale=1.2] at (${fA(cToX(Math.round(sumC/cnt)))},${fA(rToY(Math.round(sumR/cnt)))}) {$${ag.label}$};`);
      }
    }

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
        let lo = rawSqrtLo, hi = rawSqrtHi;
        // The sqrt argument in screen coords is a*\x + b; valid when a*\x + b >= 0
        let a = 1, b = 0;
        for (const t of tr) {
          if (t.type === 'hshift')       { b += t.value; }
          else if (t.type === 'hscale')  { a *= t.value; b *= t.value; }
          else if (t.type === 'hflip')   { a = -a; b = -b; }
        }
        if (Math.abs(a) < 1e-9) {
          if (b < 0) continue;
        } else {
          const threshold = -b / a;
          if (a > 0) lo = Math.max(lo, threshold);
          else       hi = Math.min(hi, threshold);
        }
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
        let lo = rawLogLo, hi = rawLogHi;
        const logEps = 0.01;
        // The log argument in screen coords is a*\x + b; valid when a*\x + b > 0
        let a = 1, b = 0;
        for (const t of tr) {
          if (t.type === 'hshift')       { b += t.value; }
          else if (t.type === 'hscale')  { a *= t.value; b *= t.value; }
          else if (t.type === 'hflip')   { a = -a; b = -b; }
        }
        if (Math.abs(a) < 1e-9) {
          if (b <= 0) continue;
        } else {
          const threshold = -b / a;
          if (a > 0) lo = Math.max(lo, threshold + logEps);
          else       hi = Math.min(hi, threshold - logEps);
        }
        if (lo < hi) lines.push(`\\draw[thick] plot[domain=${f(lo)}:${f(hi)}, samples=60, smooth] (\\x, {${trExpr(`ln(\\x)/ln(${f(g.a)})`,tr)}});`);
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
