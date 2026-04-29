const RADIUS = 2.5;

// Standard unit circle angles in order. Any integer n maps to this table via
// modulo-16 (1-based, wrapping). Positive → CCW, negative → CW.
const ANGLE_TABLE = [
  { enum:  1, deg:  30, x:  2.1651, y:  1.25   },
  { enum:  2, deg:  45, x:  1.7678, y:  1.7678 },
  { enum:  3, deg:  60, x:  1.25,   y:  2.1651 },
  { enum:  4, deg:  90, x:  0,      y:  2.5    },
  { enum:  5, deg: 120, x: -1.25,   y:  2.1651 },
  { enum:  6, deg: 135, x: -1.7678, y:  1.7678 },
  { enum:  7, deg: 150, x: -2.1651, y:  1.25   },
  { enum:  8, deg: 180, x: -2.5,    y:  0      },
  { enum:  9, deg: 210, x: -2.1651, y: -1.25   },
  { enum: 10, deg: 225, x: -1.7678, y: -1.7678 },
  { enum: 11, deg: 240, x: -1.25,   y: -2.1651 },
  { enum: 12, deg: 270, x:  0,      y: -2.5    },
  { enum: 13, deg: 300, x:  1.25,   y: -2.1651 },
  { enum: 14, deg: 315, x:  1.7678, y: -1.7678 },
  { enum: 15, deg: 330, x:  2.1651, y: -1.25   },
  { enum: 16, deg: 360, x:  2.5,    y:  0      },
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
  const entry = ANGLE_TABLE.find(e => e.deg === deg);
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
    const entry = ANGLE_TABLE.find(e => Math.abs((e.deg * Math.PI) / 180 - normalizedRad) < 1e-9);
    const deg = parseFloat((rad * 180 / Math.PI).toFixed(4));
    if (entry) return { x: entry.x, y: entry.y, deg };
    return {
      x: parseFloat((RADIUS * Math.cos(rad)).toFixed(4)),
      y: parseFloat((RADIUS * Math.sin(rad)).toFixed(4)),
      deg,
    };
  }

  const num = Number(s);
  if (isNaN(num)) return { error: `Cannot parse angle: "${val}"` };

  if (Number.isInteger(num)) {
    // Degrees take priority: normalize to (0, 360] and check against standard angles
    const normalized = ((num % 360) + 360) % 360 || 360;
    const degEntry = ANGLE_TABLE.find(e => e.deg === normalized);
    if (degEntry) return { x: degEntry.x, y: degEntry.y, deg: num };
    // Otherwise → modulo-16 enumeration (positive = CCW, negative = CW)
    const idx = ((num - 1) % 16 + 16) % 16;
    const e = ANGLE_TABLE[idx];
    // Negative input → negative arc angle (CW); avoid 0 by mapping 360 → -360
    const arcDeg = num < 0 ? (e.deg - 360 || -360) : e.deg;
    return { x: e.x, y: e.y, deg: arcDeg };
  }

  // Non-integer decimal → degrees
  const coords = coordsFromDeg(num);
  return { ...coords, deg: num };
}

const BASE_LINES = [
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
];

// angle: stops at { or whitespace. {arcLabel} is optional arc annotation.
// Bracket: (label) = hollow, [label] = filled. Label may be empty.
const ROTANGLE_RE = /^rotangle\s+([^\s{]+)(?:\{([^}]*)\})?(?:\s+(?:\((.*)\)|\[(.*)\]))?$/;

function syntaxCheck(content) {
  const trimmed = content.trim();
  if (trimmed === "") return { valid: true, errors: [] };

  const m = trimmed.match(ROTANGLE_RE);
  if (!m)
    return {
      valid: false,
      errors: [`Unknown argument: "${trimmed}". Expected: rotangle <angle> [(label) or [label]]`],
    };

  const result = parseAngle(m[1]);  // m[1] is still the angle value
  if (result.error) return { valid: false, errors: [result.error] };

  return { valid: true, errors: [] };
}

function compile(content) {
  const lines = [...BASE_LINES];
  const trimmed = content.trim();

  let rotCoords = null;
  if (trimmed !== "") {
    const m = trimmed.match(ROTANGLE_RE);
    rotCoords = parseAngle(m[1]);
  }

  const oInQ3 = rotCoords && rotCoords.x < 0 && rotCoords.y < 0;
  lines.push(oInQ3
    ? `\\node[below, scale=1.5] at (0.3,0.1) {$O$};`
    : `\\node[below, scale=1.5] at (-0.3,0) {$O$};`
  );

  if (trimmed !== "") {
    const m = trimmed.match(ROTANGLE_RE);
    const { x, y, deg } = rotCoords;
    const arcLabel = m[2] || null;
    const hollow = m[3] !== undefined;   // () branch matched
    const filled = m[4] !== undefined;   // [] branch matched
    const label = hollow ? m[3] : filled ? m[4] : null;

    const arcRad = (deg * Math.PI) / 180;
    const cosA = Math.cos(arcRad);
    const sinA = Math.sin(arcRad);
    const arcX = fmt(0.6 * cosA);
    const arcY = fmt(0.6 * sinA);
    // Arrow rotated slightly inward from the tangent so it sits on the arc line.
    // CCW arc (positive deg): rotate CW (-14°). CW arc (negative deg): rotate CCW (+14°).
    const cw = deg < 0;
    const arrowRad = arcRad + ((cw ? 14 : -14) * Math.PI) / 180;
    const cosAr = Math.cos(arrowRad);
    const sinAr = Math.sin(arrowRad);
    // CCW tangent: (-sinAr, cosAr) — CW tangent: (sinAr, -cosAr)
    // Wings: tip − 0.2·tangent ± 0.1·normal(cosAr, sinAr)
    const w1x = fmt(0.6 * cosA + (cw ? -1 : 1) * 0.2 * sinAr + 0.1 * cosAr);
    const w1y = fmt(0.6 * sinA + (cw ?  1 : -1) * 0.2 * cosAr + 0.1 * sinAr);
    const w2x = fmt(0.6 * cosA + (cw ? -1 : 1) * 0.2 * sinAr - 0.1 * cosAr);
    const w2y = fmt(0.6 * sinA + (cw ?  1 : -1) * 0.2 * cosAr - 0.1 * sinAr);
    lines.push(``, `% Rotation angle`);
    lines.push(`\\draw[thick] (0.6,0) arc[start angle=0, end angle=${deg}, x radius=0.6, y radius=0.6];`);
    lines.push(`\\fill (${arcX}, ${arcY}) -- (${w1x}, ${w1y}) -- (${w2x}, ${w2y}) -- cycle;`);
    lines.push(`\\draw[line width=1pt] (0,0) -- (${fmt(x)}, ${fmt(y)});`);

    if (arcLabel) {
      const midRad = arcRad / 2;
      const cosMid = Math.cos(midRad);
      const sinMid = Math.sin(midRad);
      const lblX = fmt(0.9 * cosMid);
      const lblY = fmt(0.9 * sinMid);
      lines.push(`\\node[scale=1.5] at (${lblX}, ${lblY}) {$${arcLabel}$};`);
    }

    if (hollow || filled) {
      const fill = hollow ? "white" : "black";
      lines.push(`\\draw[line width=1.2pt, fill=${fill}] (${fmt(x)}, ${fmt(y)}) circle (2pt);`);

      if (label) {
        const align = x < 0 ? "left" : "right";
        const labelY = fmt(y < 0 ? y - 0.3 : y + 0.3);
        lines.push(`\\node[${align}, scale=1.5] at (${fmt(x)}, ${labelY}) {$${label}$};`);
      }
    }
  }

  return `\\begin{document}\n\n\\begin{tikzpicture}\n${lines.join("\n")}\n\\end{tikzpicture}\n\n\\end{document}`;
}

export default [
  { prefix: "unit-circle:", syntaxCheck, compile },
];
