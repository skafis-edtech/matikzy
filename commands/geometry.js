const ANGLE_TYPES = new Set(["acute", "right", "obtuse"]);
const SIDE_TYPES  = new Set(["equilateral", "isosceles", "scalene"]);

// Parse "ABC", "[A]BC", "A(B)C", "[A](B)C", "DEF" etc. into 3 vertex descriptors.
// mod: "none" | "mark" ([] = special angle) | "hide" (() = no label rendered)
function parseLabels(str) {
  if (!str) return null;
  const verts = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === "[") {
      const close = str.indexOf("]", i + 1);
      if (close === -1) return null;
      verts.push({ label: str.slice(i + 1, close), mod: "mark" });
      i = close + 1;
    } else if (str[i] === "(") {
      const close = str.indexOf(")", i + 1);
      if (close === -1) return null;
      verts.push({ label: str.slice(i + 1, close), mod: "hide" });
      i = close + 1;
    } else {
      verts.push({ label: str[i], mod: "none" });
      i++;
    }
  }
  return verts.length === 3 ? verts : null;
}

function parseTriangle(content) {
  const words = content.trim().split(/\s+/);
  if (words[0] !== "triangle") return { angle: null, side: null, unknown: words, labelStr: null };

  let angle = null, side = null, labelStr = null;
  const unknown = [];

  for (const word of words.slice(1)) {
    if (ANGLE_TYPES.has(word))                       { angle === null    ? (angle    = word) : unknown.push(word); }
    else if (SIDE_TYPES.has(word))                   { side  === null    ? (side     = word) : unknown.push(word); }
    else if (labelStr === null && parseLabels(word)) { labelStr = word; }
    else                                             { unknown.push(word); }
  }

  return { angle, side, unknown, labelStr };
}

// COORDS[side][angle] = coords for default [A]BC (special angle at position 0, bottom-left).
// COORDS_ALT[side][angle][specialPos] = coords when [] is on position 1 or 2.
// Each entry: { bx, by, cx, bPos } per size.
// Sizes scaled from medium: small ≈ ×0.615, large ≈ ×1.538.
const COORDS = {
  scalene: {
    // medium: (0,0)--(0.943,2.759)--(6.152,0)
    acute: {
      small:  { bx: 0.58,   by: 1.698, cx: 3.786, bPos: "above"      },
      medium: { bx: 0.943,  by: 2.759, cx: 6.152, bPos: "above"      },
      large:  { bx: 1.45,   by: 4.245, cx: 9.465, bPos: "above"      },
    },
    // medium: (0,0)--(0,3)--(5,0)  [A]BC: right angle at bottom-left
    right: {
      small:  { bx: 0, by: 1.846, cx: 3.077, bPos: "above left" },
      medium: { bx: 0, by: 3,     cx: 5,     bPos: "above left" },
      large:  { bx: 0, by: 4.615, cx: 7.692, bPos: "above left" },
    },
    // medium: (0,0)--(-1.5,3)--(5,0)  [A]BC: obtuse angle at bottom-left
    obtuse: {
      small:  { bx: -0.923, by: 1.846, cx: 3.077, bPos: "above left" },
      medium: { bx: -1.5,   by: 3,     cx: 5,     bPos: "above left" },
      large:  { bx: -2.308, by: 4.615, cx: 7.692, bPos: "above left" },
    },
  },
  isosceles: {
    // medium: (0,0)--(2,5)--(4,0)  default A[B]C: special angle at top
    acute: {
      small:  { bx: 1.231, by: 3.077, cx: 2.462, bPos: "above" },
      medium: { bx: 2,     by: 5,     cx: 4,     bPos: "above" },
      large:  { bx: 3.077, by: 7.692, cx: 6.154, bPos: "above" },
    },
    // medium: (0,0)--(0,4)--(4,0)  [equal legs]
    right: {
      small:  { bx: 0, by: 2.462, cx: 2.462, bPos: "above left" },
      medium: { bx: 0, by: 4,     cx: 4,     bPos: "above left" },
      large:  { bx: 0, by: 6.154, cx: 6.154, bPos: "above left" },
    },
    // medium: (0,0)--(-3,4)--(5,0)  [obtuse angle at A; |AB|=|AC|=5]
    obtuse: {
      small:  { bx: -1.846, by: 2.462, cx: 3.077, bPos: "above left" },
      medium: { bx: -3,     by: 4,     cx: 5,     bPos: "above left" },
      large:  { bx: -4.615, by: 6.154, cx: 7.692, bPos: "above left" },
    },
  },
  equilateral: {
    // medium: (0,0)--(2.5,4.330)--(5,0)  [side = 5]
    acute: {
      small:  { bx: 1.538, by: 2.665, cx: 3.077, bPos: "above" },
      medium: { bx: 2.5,   by: 4.330, cx: 5,     bPos: "above" },
      large:  { bx: 3.846, by: 6.662, cx: 7.692, bPos: "above" },
    },
  },
};

// Alternative coord sets for when [] is on position 1 (top) or 2 (bottom-right).
// Only defined where the user has provided specific coordinates.
const COORDS_ALT = {
  isosceles: {
    acute: {
      // medium: (0,0)--(3.90,3.71)--(5.39,0)  [A]BC: special angle at bottom-left
      0: {
        small:  { bx: 2.400, by: 2.284, cx: 3.318, bPos: "above" },
        medium: { bx: 3.90,  by: 3.71,  cx: 5.39,  bPos: "above" },
        large:  { bx: 6.0,   by: 5.708, cx: 8.292, bPos: "above" },
      },
      // medium: (0,0)--(1.49,3.71)--(5.39,0)  AB[C]: special angle at bottom-right
      2: {
        small:  { bx: 0.917, by: 2.284, cx: 3.318, bPos: "above" },
        medium: { bx: 1.49,  by: 3.71,  cx: 5.39,  bPos: "above" },
        large:  { bx: 2.292, by: 5.708, cx: 8.292, bPos: "above" },
      },
    },
    right: {
      // medium: (0,0)--(2.83,2.83)--(5.66,0)  A[B]C: right angle at top
      1: {
        small:  { bx: 1.742, by: 1.742, cx: 3.483, bPos: "above"       },
        medium: { bx: 2.83,  by: 2.83,  cx: 5.66,  bPos: "above"       },
        large:  { bx: 4.354, by: 4.354, cx: 8.708, bPos: "above"       },
      },
      // medium: (0,0)--(4,4)--(4,0)  AB[C]: right angle at bottom-right
      2: {
        small:  { bx: 2.462, by: 2.462, cx: 2.462, bPos: "above right" },
        medium: { bx: 4,     by: 4,     cx: 4,     bPos: "above right" },
        large:  { bx: 6.154, by: 6.154, cx: 6.154, bPos: "above right" },
      },
    },
    obtuse: {
      // medium: (0,0)--(4.472,2.236)--(8.944,0)  A[B]C: obtuse angle at top
      1: {
        small:  { bx: 2.752, by: 1.376, cx: 5.503,  bPos: "above"       },
        medium: { bx: 4.472, by: 2.236, cx: 8.944,  bPos: "above"       },
        large:  { bx: 6.880, by: 3.439, cx: 13.760, bPos: "above"       },
      },
      // medium: (0,0)--(8,4)--(5,0)  AB[C]: obtuse angle at bottom-right
      2: {
        small:  { bx: 4.923, by: 2.462, cx: 3.077, bPos: "above right" },
        medium: { bx: 8,     by: 4,     cx: 5,     bPos: "above right" },
        large:  { bx: 12.308,by: 6.154, cx: 7.692, bPos: "above right" },
      },
    },
  },
  scalene: {
    // medium: (0,0)--(1.54,2.57)--(5.83,0)  A[B]C: right angle at top
    right: {
      1: {
        small:  { bx: 0.948, by: 1.581, cx: 3.588, bPos: "above" },
        medium: { bx: 1.54,  by: 2.57,  cx: 5.83,  bPos: "above" },
        large:  { bx: 2.369, by: 3.954, cx: 8.97,  bPos: "above" },
      },
      // medium: (0,0)--(5,3)--(5,0)  AB[C]: right angle at bottom-right
      2: {
        small:  { bx: 3.077, by: 1.846, cx: 3.077, bPos: "above right" },
        medium: { bx: 5,     by: 3,     cx: 5,     bPos: "above right" },
        large:  { bx: 7.692, by: 4.615, cx: 7.692, bPos: "above right" },
      },
    },
    // medium: (0,0)--(2.62,2.09)--(7.16,0)  A[B]C: obtuse angle at top
    obtuse: {
      1: {
        small:  { bx: 1.612, by: 1.286, cx: 4.407,  bPos: "above" },
        medium: { bx: 2.62,  by: 2.09,  cx: 7.16,   bPos: "above" },
        large:  { bx: 4.031, by: 3.215, cx: 11.015, bPos: "above" },
      },
      // medium: (0,0)--(6.5,3)--(5,0)  AB[C]: obtuse angle at bottom-right
      2: {
        small:  { bx: 4.0,   by: 1.846, cx: 3.077, bPos: "above right" },
        medium: { bx: 6.5,   by: 3,     cx: 5,     bPos: "above right" },
        large:  { bx: 10.0,  by: 4.615, cx: 7.692, bPos: "above right" },
      },
    },
  },
};

// Per-(side,angle) default for which position is the special-angle vertex.
// Falls back to 0 if not listed.
const DEFAULT_SPECIAL_POS = {
  isosceles: { acute: 1 },
};

function f(n) {
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(3));
}

// Draws a right-angle square at vertex V between adjacent vertices P1 and P2.
function rightAngleMark(vx, vy, p1x, p1y, p2x, p2y, s = 0.25) {
  const d1 = Math.hypot(p1x - vx, p1y - vy);
  const d2 = Math.hypot(p2x - vx, p2y - vy);
  const u1x = (p1x - vx) / d1, u1y = (p1y - vy) / d1;
  const u2x = (p2x - vx) / d2, u2y = (p2y - vy) / d2;
  const ax = f(vx + s * u1x),             ay = f(vy + s * u1y);
  const bx = f(vx + s * u1x + s * u2x),  by = f(vy + s * u1y + s * u2y);
  const cx = f(vx + s * u2x),             cy = f(vy + s * u2y);
  return `\\draw[line width=1pt] (${ax},${ay}) -- (${bx},${by}) -- (${cx},${cy});`;
}

function syntaxCheck(content) {
  const errors = [];
  const { angle, side, unknown, labelStr } = parseTriangle(content);

  if (content.trim().split(/\s+/)[0] !== "triangle") {
    return { valid: false, errors: [`Unknown shape. Only "triangle" is supported.`] };
  }

  if (unknown.length > 0) {
    errors.push(`Unknown modifier(s): ${unknown.map((w) => `"${w}"`).join(", ")}`);
  }

  if (side === "equilateral" && angle === "right")  errors.push("Equilateral triangles cannot be right-angled.");
  if (side === "equilateral" && angle === "obtuse") errors.push("Equilateral triangles cannot be obtuse.");

  if (labelStr !== null) {
    const parsed = parseLabels(labelStr);
    if (!parsed) {
      errors.push(`Invalid label specification: "${labelStr}"`);
    } else if (parsed.filter((v) => v.mod === "mark").length > 1) {
      errors.push("Only one vertex can be marked with [].");
    }
  }

  return { valid: errors.length === 0, errors };
}

function compile(content, size) {
  const { angle: rawAngle, side: rawSide, labelStr } = parseTriangle(content);
  const angle = rawAngle ?? "acute";
  const side  = rawSide  ?? "scalene";

  // Labels map directly by position order. No mark = use DEFAULT_SPECIAL_POS.
  const labels = parseLabels(labelStr) ?? [
    { label: "A", mod: "none" },
    { label: "B", mod: "none" },
    { label: "C", mod: "none" },
  ];

  const markedIdx = labels.findIndex((v) => v.mod === "mark");
  const specialPos = markedIdx !== -1
    ? markedIdx
    : (DEFAULT_SPECIAL_POS[side]?.[angle] ?? 0);
  const altSizeMap = COORDS_ALT[side]?.[angle]?.[specialPos];
  const { bx, by, cx, bPos } = (altSizeMap ?? COORDS[side][angle])[size];

  // Positions are always fixed: [0]=bottom-left, [1]=top, [2]=bottom-right.
  const positions = [
    { x: 0,  y: 0,  pos: "below left"  },
    { x: bx, y: by, pos: bPos           },
    { x: cx, y: 0,  pos: "below right" },
  ];

  const lines = [];
  lines.push(`\\draw[line width=1.5pt] (0,0) -- (${bx},${by}) -- (${cx},0) -- cycle;`);
  lines.push("");

  // Right angle square at the special-angle vertex.
  if (angle === "right") {
    const [j, k] = [0, 1, 2].filter((i) => i !== specialPos);
    lines.push(rightAngleMark(
      positions[specialPos].x, positions[specialPos].y,
      positions[j].x,          positions[j].y,
      positions[k].x,          positions[k].y,
    ));
  }

  for (let i = 0; i < 3; i++) {
    const { label, mod } = labels[i];
    const { x, y, pos } = positions[i];
    if (mod !== "hide") {
      lines.push(`\\node[${pos}, scale=1.5] at (${f(x)},${f(y)}) {$${label}$};`);
    }
  }

  return `\\begin{document}\n\n\\begin{tikzpicture}\n\n${lines.join("\n")}\n\n\\end{tikzpicture}\n\n\\end{document}`;
}

function makeCompile(size) {
  return (content) => compile(content, size);
}

export default [
  { prefix: "geometry:",         syntaxCheck, compile: makeCompile("medium") }, // default
  { prefix: "geometry[small]:",  syntaxCheck, compile: makeCompile("small") },
  { prefix: "geometry[medium]:", syntaxCheck, compile: makeCompile("medium") },
  { prefix: "geometry[large]:",  syntaxCheck, compile: makeCompile("large") },
];
