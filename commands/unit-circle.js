const RADIUS = 2.5;

// Standard unit circle angles in order.
const ANGLE_TABLE = [
  { enum: 1, deg: 30, x: 2.1651, y: 1.25 },
  { enum: 2, deg: 45, x: 1.7678, y: 1.7678 },
  { enum: 3, deg: 60, x: 1.25, y: 2.1651 },
  { enum: 4, deg: 90, x: 0, y: 2.5 },
  { enum: 5, deg: 120, x: -1.25, y: 2.1651 },
  { enum: 6, deg: 135, x: -1.7678, y: 1.7678 },
  { enum: 7, deg: 150, x: -2.1651, y: 1.25 },
  { enum: 8, deg: 180, x: -2.5, y: 0 },
  { enum: 9, deg: 210, x: -2.1651, y: -1.25 },
  { enum: 10, deg: 225, x: -1.7678, y: -1.7678 },
  { enum: 11, deg: 240, x: -1.25, y: -2.1651 },
  { enum: 12, deg: 270, x: 0, y: -2.5 },
  { enum: 13, deg: 300, x: 1.25, y: -2.1651 },
  { enum: 14, deg: 315, x: 1.7678, y: -1.7678 },
  { enum: 15, deg: 330, x: 2.1651, y: -1.25 },
  { enum: 16, deg: 360, x: 2.5, y: 0 },
];

function fmt(n) {
  return parseFloat(n.toFixed(4)).toString();
}

// Parse "pi" notation (input already lowercased, whitespace stripped).
// Only accepts [−]<int>/<int>pi — e.g. "1/2pi", "-3/4pi", "11/6pi"
function parsePiRadians(s) {
  const m = s.match(/^(-?)(\d+)\/(\d+)pi$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2]) / parseInt(m[3])) * Math.PI;
}

function coordsFromDeg(deg) {
  const entry = ANGLE_TABLE.find((e) => e.deg === deg);
  if (entry) return { x: entry.x, y: entry.y };
  const rad = (deg * Math.PI) / 180;
  return {
    x: parseFloat((RADIUS * Math.cos(rad)).toFixed(4)),
    y: parseFloat((RADIUS * Math.sin(rad)).toFixed(4)),
  };
}

// Returns { x, y, deg } or { error: string }
function parseAngle(val) {
  const s = val.trim().toLowerCase().replace(/\s+/g, "");

  if (s.includes("pi")) {
    const rad = parsePiRadians(s);
    if (rad === null) return { error: `Cannot parse pi notation: "${val}"` };
    const normalizedRad = ((rad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const entry = ANGLE_TABLE.find(
      (e) => Math.abs((e.deg * Math.PI) / 180 - normalizedRad) < 1e-9,
    );
    const deg = parseFloat(((rad * 180) / Math.PI).toFixed(4));
    if (entry) return { x: entry.x, y: entry.y, deg };
    return {
      x: parseFloat((RADIUS * Math.cos(rad)).toFixed(4)),
      y: parseFloat((RADIUS * Math.sin(rad)).toFixed(4)),
      deg,
    };
  }

  const num = Number(s);
  if (isNaN(num)) return { error: `Cannot parse angle: "${val}"` };

  // All numeric input (integer or decimal) treated as degrees
  const coords = coordsFromDeg(num);
  return { ...coords, deg: num };
}

const BASE_LINES = [
  `% Circle`,
  `\\draw[line width=1.2pt] (0,0) circle (2.5);`,
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
];

// Syntax:
//   point <angle> new <name>        — declare a named point on the circle
//   label <name> [<text>]           — filled dot with label
//   label <name> (<text>)           — hollow dot with label
//   label <name> <text>             — label only, no dot
//   rotangle <from>-<to> <arcLabel> — arc with arrowhead and label
//   x-line <name> [-- dotted|dashed|solid]  — vertical line to x-axis (default dotted)
//   y-line <name> [-- dotted|dashed|solid]  — horizontal line to y-axis (default dotted)
//
// Point X at 0° is always implicit and can be omitted.

const POINT_RE = /^point\s+(\S+)\s+new\s+([A-Za-z]\w*)$/;
const LABEL_RE = /^label\s+([A-Za-z]\w*)\s+(?:\[([^\]]*)\]|\(([^)]*)\)|(.+))$/;
const ROTANGLE_RE = /^rotangle\s+([A-Za-z]\w*)-([A-Za-z]\w*)\s+(.+)$/;
const XLINE_RE = /^x-line\s+([A-Za-z]\w*)(?:\s+--\s+(dotted|dashed|solid))?$/;
const YLINE_RE = /^y-line\s+([A-Za-z]\w*)(?:\s+--\s+(dotted|dashed|solid))?$/;

function parseCommands(content) {
  const lines = content
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => l !== "");

  const errors = [];
  const points = { X: { ...coordsFromDeg(0), deg: 0 } };
  const labels = {};
  const rotangles = [];
  const xlines = [];
  const ylines = [];

  for (const line of lines) {
    let m;
    if ((m = line.match(POINT_RE))) {
      const angle = parseAngle(m[1]);
      if (angle.error) {
        errors.push(angle.error);
        continue;
      }
      points[m[2]] = angle;
    } else if ((m = line.match(LABEL_RE))) {
      labels[m[1]] = { text: m[2] ?? m[3] ?? m[4], dot: m[2] !== undefined ? "filled" : m[3] !== undefined ? "hollow" : null };
    } else if ((m = line.match(ROTANGLE_RE))) {
      rotangles.push({ from: m[1], to: m[2], arcLabel: m[3] });
    } else if ((m = line.match(XLINE_RE))) {
      xlines.push({ name: m[1], style: m[2] ?? "dotted" });
    } else if ((m = line.match(YLINE_RE))) {
      ylines.push({ name: m[1], style: m[2] ?? "dotted" });
    } else {
      errors.push(`Unknown command: "${line}"`);
    }
  }

  return { points, labels, rotangles, xlines, ylines, errors };
}

function syntaxCheck(content) {
  const trimmed = content.trim();
  if (trimmed === "") return { valid: true, errors: [] };

  const { points, labels, rotangles, xlines, ylines, errors } = parseCommands(trimmed);
  if (errors.length > 0) return { valid: false, errors };

  for (const { from, to } of rotangles) {
    if (!points[from])
      return { valid: false, errors: [`Undefined point: "${from}"`] };
    if (!points[to])
      return { valid: false, errors: [`Undefined point: "${to}"`] };
  }
  for (const name of Object.keys(labels)) {
    if (!points[name])
      return { valid: false, errors: [`Undefined point: "${name}"`] };
  }
  for (const { name } of [...xlines, ...ylines]) {
    if (!points[name])
      return { valid: false, errors: [`Undefined point: "${name}"`] };
  }

  return { valid: true, errors: [] };
}

function compile(content) {
  const lines = [...BASE_LINES];
  const trimmed = content.trim();

  const { points, labels, rotangles, xlines, ylines } =
    trimmed !== ""
      ? parseCommands(trimmed)
      : { points: {}, labels: {}, rotangles: [], xlines: [], ylines: [] };

  const oInQ3 = rotangles.some(({ to }) => {
    const pt = points[to];
    return pt && pt.x < 0 && pt.y < 0;
  });
  lines.push(
    oInQ3
      ? `\\node[below, scale=1.5] at (0.3,0.1) {$O$};`
      : `\\node[below, scale=1.5] at (-0.3,0) {$O$};`,
  );

  for (const { from, to, arcLabel } of rotangles) {
    const fromPt = points[from];
    const toPt = points[to];
    const { x, y, deg: toDeg } = toPt;
    const fromDeg = fromPt.deg;
    const span = toDeg - fromDeg;

    const arcRad = (toDeg * Math.PI) / 180;
    const cosA = Math.cos(arcRad);
    const sinA = Math.sin(arcRad);
    const arcX = fmt(0.6 * cosA);
    const arcY = fmt(0.6 * sinA);

    const cw = span < 0;
    const arrowRad = arcRad + ((cw ? 14 : -14) * Math.PI) / 180;
    const cosAr = Math.cos(arrowRad);
    const sinAr = Math.sin(arrowRad);
    const w1x = fmt(0.6 * cosA + (cw ? -1 : 1) * 0.2 * sinAr + 0.1 * cosAr);
    const w1y = fmt(0.6 * sinA + (cw ? 1 : -1) * 0.2 * cosAr + 0.1 * sinAr);
    const w2x = fmt(0.6 * cosA + (cw ? -1 : 1) * 0.2 * sinAr - 0.1 * cosAr);
    const w2y = fmt(0.6 * sinA + (cw ? 1 : -1) * 0.2 * cosAr - 0.1 * sinAr);

    const startX = fmt(0.6 * Math.cos((fromDeg * Math.PI) / 180));
    const startY = fmt(0.6 * Math.sin((fromDeg * Math.PI) / 180));

    lines.push(``, `% Rotation angle`);
    lines.push(
      `\\draw[thick] (${startX},${startY}) arc[start angle=${fromDeg}, end angle=${toDeg}, x radius=0.6, y radius=0.6];`,
    );
    lines.push(
      `\\fill (${arcX}, ${arcY}) -- (${w1x}, ${w1y}) -- (${w2x}, ${w2y}) -- cycle;`,
    );
    lines.push(`\\draw[line width=1pt] (0,0) -- (${fmt(fromPt.x)}, ${fmt(fromPt.y)});`);
    lines.push(`\\draw[line width=1pt] (0,0) -- (${fmt(x)}, ${fmt(y)});`);

    if (arcLabel) {
      const midRad = (((fromDeg + toDeg) / 2) * Math.PI) / 180;
      const cosMid = Math.cos(midRad);
      const sinMid = Math.sin(midRad);
      const lblX = fmt(0.9 * cosMid);
      const lblY = fmt(0.9 * sinMid);
      lines.push(`\\node[scale=1.5] at (${lblX}, ${lblY}) {$${arcLabel}$};`);
    }
  }

  for (const { name, style } of xlines) {
    const pt = points[name];
    if (!pt) continue;
    const s = style === "solid" ? "line width=1pt" : `${style}, line width=1pt`;
    lines.push(`\\draw[${s}] (${fmt(pt.x)}, ${fmt(pt.y)}) -- (${fmt(pt.x)}, 0);`);
  }
  for (const { name, style } of ylines) {
    const pt = points[name];
    if (!pt) continue;
    const s = style === "solid" ? "line width=1pt" : `${style}, line width=1pt`;
    lines.push(`\\draw[${s}] (${fmt(pt.x)}, ${fmt(pt.y)}) -- (0, ${fmt(pt.y)});`);
  }

  for (const [name, { text, dot }] of Object.entries(labels)) {
    const pt = points[name];
    if (!pt) continue;
    const { x, y } = pt;
    if (dot !== null) {
      const fill = dot === "filled" ? "black" : "white";
      lines.push(
        `\\draw[line width=1.2pt, fill=${fill}] (${fmt(x)}, ${fmt(y)}) circle (2pt);`,
      );
    }
    if (text) {
      const align = x < 0 ? "left" : "right";
      const labelY = fmt(y < 0 ? y - 0.3 : y + 0.3);
      lines.push(
        `\\node[${align}, scale=1.5] at (${fmt(x)}, ${labelY}) {$${text}$};`,
      );
    }
  }

  return `\\begin{document}\n\n\\begin{tikzpicture}\n${lines.join("\n")}\n\\end{tikzpicture}\n\n\\end{document}`;
}

export default [{ prefix: "unit-circle:", syntaxCheck, compile }];
