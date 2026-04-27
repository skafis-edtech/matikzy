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
// Only accepts <int>/<int>pi — e.g. "1/2pi", "3/4pi", "11/6pi", "1/1pi"
function parsePiRadians(s) {
  const m = s.match(/^(\d+)\/(\d+)pi$/);
  if (!m) return null;
  return (parseInt(m[1]) / parseInt(m[2])) * Math.PI;
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

// Returns { x, y } or { error: string }
function parseAngle(val) {
  const s = val.trim().toLowerCase().replace(/\s+/g, "");

  if (s.includes("pi")) {
    const rad = parsePiRadians(s);
    if (rad === null) return { error: `Cannot parse pi notation: "${val}"` };
    const entry = ANGLE_TABLE.find(e => Math.abs((e.deg * Math.PI) / 180 - rad) < 1e-9);
    if (entry) return { x: entry.x, y: entry.y };
    return {
      x: parseFloat((RADIUS * Math.cos(rad)).toFixed(4)),
      y: parseFloat((RADIUS * Math.sin(rad)).toFixed(4)),
    };
  }

  const num = Number(s);
  if (isNaN(num)) return { error: `Cannot parse angle: "${val}"` };

  if (Number.isInteger(num)) {
    // Degrees take priority: normalize to (0, 360] and check against standard angles
    const normalized = ((num % 360) + 360) % 360 || 360;
    const degEntry = ANGLE_TABLE.find(e => e.deg === normalized);
    if (degEntry) return { x: degEntry.x, y: degEntry.y };
    // Otherwise → modulo-16 enumeration (positive = CCW, negative = CW)
    const idx = ((num - 1) % 16 + 16) % 16;
    return { x: ANGLE_TABLE[idx].x, y: ANGLE_TABLE[idx].y };
  }

  // Non-integer decimal → degrees
  return coordsFromDeg(num);
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
  `\\node[below, scale=1.5] at (-0.3,0) {$O$};`,
];

function syntaxCheck(content) {
  const trimmed = content.trim();
  if (trimmed === "") return { valid: true, errors: [] };

  const m = trimmed.match(/^rotangle\s+(\S+)(?:\s+(\(\)|\[\]))?$/);
  if (!m)
    return {
      valid: false,
      errors: [`Unknown argument: "${trimmed}". Expected: rotangle <angle> [() or []]`],
    };

  const result = parseAngle(m[1]);
  if (result.error) return { valid: false, errors: [result.error] };

  return { valid: true, errors: [] };
}

function compile(content) {
  const lines = [...BASE_LINES];
  const trimmed = content.trim();

  if (trimmed !== "") {
    const m = trimmed.match(/^rotangle\s+(\S+)(?:\s+(\(\)|\[\]))?$/);
    const { x, y } = parseAngle(m[1]);
    const point = m[2];
    lines.push(``, `% Rotation angle`);
    lines.push(`\\draw[line width=1pt] (0,0) -- (${fmt(x)}, ${fmt(y)});`);
    if (point === "()") {
      lines.push(`\\draw[line width=1.2pt, fill=white] (${fmt(x)}, ${fmt(y)}) circle (2pt);`);
    } else if (point === "[]") {
      lines.push(`\\draw[line width=1.2pt, fill=black] (${fmt(x)}, ${fmt(y)}) circle (2pt);`);
    }
  }

  return lines.join("\n");
}

export default [
  { prefix: "unit-circle:", syntaxCheck, compile },
];
