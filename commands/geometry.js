const ANGLE_TYPES = new Set(["acute", "right", "obtuse"]);
const SIDE_TYPES = new Set(["equilateral", "isosceles", "scalene"]);
const VALID_TRI_MODES = new Set(["SSS", "SAS", "ASA", "AAS"]);

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
    } else {
      verts.push({ label: str[i], mod: "none" });
      i++;
    }
  }
  return verts.length === 3 ? verts : null;
}

function parseQuadLabels(str) {
  if (!str) return null;
  const verts = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === "[") {
      const close = str.indexOf("]", i + 1);
      if (close === -1) return null;
      verts.push({ label: str.slice(i + 1, close), mod: "mark" });
      i = close + 1;
    } else {
      verts.push({ label: str[i], mod: "none" });
      i++;
    }
  }
  return verts.length === 4 ? verts : null;
}

function parseTriangle(content) {
  const words = content.trim().split(/\s+/);
  if (words[0] !== "triangle")
    return { angle: null, side: null, unknown: words, labelStr: null, triMode: null, triValues: null, triTransforms: [] };

  // New numeric format: triangle SSS/SAS/ASA/AAS v1 v2 v3 [label] [>>transforms...]
  if (words.length >= 2 && VALID_TRI_MODES.has(words[1])) {
    const mode = words[1];
    const unknown = [];

    let transformStart = words.length;
    for (let i = 2; i < words.length; i++) {
      if (words[i].startsWith(">>")) { transformStart = i; break; }
    }

    const mainWords = words.slice(2, transformStart);
    const transformWords = words.slice(transformStart);

    const numericWords = mainWords.filter(w => /^-?\d*\.?\d+$/.test(w));
    const nonNumeric = mainWords.filter(w => !/^-?\d*\.?\d+$/.test(w));

    let triValues = null;
    if (numericWords.length >= 3) triValues = numericWords.slice(0, 3).map(Number);
    if (numericWords.length > 3) unknown.push(...numericWords.slice(3));

    let labelStr = null;
    for (const w of nonNumeric) {
      if (labelStr === null && parseLabels(w)) labelStr = w;
      else unknown.push(w);
    }

    const triTransforms = [];
    for (const tw of transformWords) {
      if (tw === ">>rot") {
        triTransforms.push({ type: "rot", degrees: null });
      } else if (tw === ">>invert") {
        triTransforms.push({ type: "invert" });
      } else if (/^>>rot-?\d+(\.\d+)?$/.test(tw)) {
        triTransforms.push({ type: "rot", degrees: parseFloat(tw.slice(5)) });
      } else {
        unknown.push(tw);
      }
    }

    return { angle: null, side: null, unknown, labelStr, triMode: mode, triValues, triTransforms };
  }

  // Original keyword format
  let angle = null, side = null, labelStr = null;
  const unknown = [];

  for (const word of words.slice(1)) {
    if (ANGLE_TYPES.has(word)) {
      angle === null ? (angle = word) : unknown.push(word);
    } else if (SIDE_TYPES.has(word)) {
      side === null ? (side = word) : unknown.push(word);
    } else if (labelStr === null && parseLabels(word)) {
      labelStr = word;
    } else {
      unknown.push(word);
    }
  }

  return { angle, side, unknown, labelStr, triMode: null, triValues: null, triTransforms: [] };
}

const QUAD_SINGLE_TYPES = new Set(["square", "rectangle", "parallelogram", "rhombus", "trapezoid"]);

function parseQuadrilateral(content) {
  const words = content.trim().split(/\s+/);
  if (words[0] !== "quadrilateral") return null;

  let transformStart = words.length;
  for (let i = 1; i < words.length; i++) {
    if (words[i].startsWith(">>")) { transformStart = i; break; }
  }

  const mainWords = words.slice(1, transformStart);
  const transformWords = words.slice(transformStart);

  let quadType = null;
  let labelStr = null;
  const unknown = [];

  let i = 0;
  while (i < mainWords.length) {
    const w = mainWords[i];
    const wNext = mainWords[i + 1];
    const twoWord = (w === "right" || w === "isosceles") && wNext === "trapezoid"
      ? w + " " + wNext : null;
    if (twoWord) {
      quadType === null ? (quadType = twoWord, i += 2) : (unknown.push(w), i++);
    } else if (QUAD_SINGLE_TYPES.has(w)) {
      quadType === null ? (quadType = w, i++) : (unknown.push(w), i++);
    } else if (labelStr === null && parseQuadLabels(w)) {
      labelStr = w; i++;
    } else {
      unknown.push(w); i++;
    }
  }

  const quadTransforms = [];
  for (const tw of transformWords) {
    if (tw === ">>rot") {
      quadTransforms.push({ type: "rot", degrees: null });
    } else if (tw === ">>invert") {
      quadTransforms.push({ type: "invert" });
    } else if (/^>>rot-?\d+(\.\d+)?$/.test(tw)) {
      quadTransforms.push({ type: "rot", degrees: parseFloat(tw.slice(5)) });
    } else {
      unknown.push(tw);
    }
  }

  return { quadType, labelStr, quadTransforms, unknown };
}

// COORDS[side][angle] = coords for default [A]BC (special angle at position 0, bottom-left).
// COORDS_ALT[side][angle][specialPos] = coords when [] is on position 1 or 2.
// Each entry: { bx, by, cx, bPos } per size.
// Sizes scaled from medium: small ≈ ×0.615, large ≈ ×1.538.
const COORDS = {
  scalene: {
    // medium: (0,0)--(0.943,2.759)--(6.152,0)
    acute: {
      small: { bx: 0.58, by: 1.698, cx: 3.786, bPos: "above" },
      medium: { bx: 0.943, by: 2.759, cx: 6.152, bPos: "above" },
      large: { bx: 1.45, by: 4.245, cx: 9.465, bPos: "above" },
    },
    // medium: (0,0)--(0,3)--(5,0)  [A]BC: right angle at bottom-left
    right: {
      small: { bx: 0, by: 1.846, cx: 3.077, bPos: "above left" },
      medium: { bx: 0, by: 3, cx: 5, bPos: "above left" },
      large: { bx: 0, by: 4.615, cx: 7.692, bPos: "above left" },
    },
    // medium: (0,0)--(-1.5,3)--(5,0)  [A]BC: obtuse angle at bottom-left
    obtuse: {
      small: { bx: -0.923, by: 1.846, cx: 3.077, bPos: "above left" },
      medium: { bx: -1.5, by: 3, cx: 5, bPos: "above left" },
      large: { bx: -2.308, by: 4.615, cx: 7.692, bPos: "above left" },
    },
  },
  isosceles: {
    // medium: (0,0)--(2,5)--(4,0)  default A[B]C: special angle at top
    acute: {
      small: { bx: 1.231, by: 3.077, cx: 2.462, bPos: "above" },
      medium: { bx: 2, by: 5, cx: 4, bPos: "above" },
      large: { bx: 3.077, by: 7.692, cx: 6.154, bPos: "above" },
    },
    // medium: (0,0)--(0,4)--(4,0)  [equal legs]
    right: {
      small: { bx: 0, by: 2.462, cx: 2.462, bPos: "above left" },
      medium: { bx: 0, by: 4, cx: 4, bPos: "above left" },
      large: { bx: 0, by: 6.154, cx: 6.154, bPos: "above left" },
    },
    // medium: (0,0)--(-3,4)--(5,0)  [obtuse angle at A; |AB|=|AC|=5]
    obtuse: {
      small: { bx: -1.846, by: 2.462, cx: 3.077, bPos: "above left" },
      medium: { bx: -3, by: 4, cx: 5, bPos: "above left" },
      large: { bx: -4.615, by: 6.154, cx: 7.692, bPos: "above left" },
    },
  },
  equilateral: {
    // medium: (0,0)--(2.5,4.330)--(5,0)  [side = 5]
    acute: {
      small: { bx: 1.538, by: 2.665, cx: 3.077, bPos: "above" },
      medium: { bx: 2.5, by: 4.33, cx: 5, bPos: "above" },
      large: { bx: 3.846, by: 6.662, cx: 7.692, bPos: "above" },
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
        small: { bx: 2.4, by: 2.284, cx: 3.318, bPos: "above" },
        medium: { bx: 3.9, by: 3.71, cx: 5.39, bPos: "above" },
        large: { bx: 6.0, by: 5.708, cx: 8.292, bPos: "above" },
      },
      // medium: (0,0)--(1.49,3.71)--(5.39,0)  AB[C]: special angle at bottom-right
      2: {
        small: { bx: 0.917, by: 2.284, cx: 3.318, bPos: "above" },
        medium: { bx: 1.49, by: 3.71, cx: 5.39, bPos: "above" },
        large: { bx: 2.292, by: 5.708, cx: 8.292, bPos: "above" },
      },
    },
    right: {
      // medium: (0,0)--(2.83,2.83)--(5.66,0)  A[B]C: right angle at top
      1: {
        small: { bx: 1.742, by: 1.742, cx: 3.483, bPos: "above" },
        medium: { bx: 2.83, by: 2.83, cx: 5.66, bPos: "above" },
        large: { bx: 4.354, by: 4.354, cx: 8.708, bPos: "above" },
      },
      // medium: (0,0)--(4,4)--(4,0)  AB[C]: right angle at bottom-right
      2: {
        small: { bx: 2.462, by: 2.462, cx: 2.462, bPos: "above right" },
        medium: { bx: 4, by: 4, cx: 4, bPos: "above right" },
        large: { bx: 6.154, by: 6.154, cx: 6.154, bPos: "above right" },
      },
    },
    obtuse: {
      // medium: (0,0)--(4.472,2.236)--(8.944,0)  A[B]C: obtuse angle at top
      1: {
        small: { bx: 2.752, by: 1.376, cx: 5.503, bPos: "above" },
        medium: { bx: 4.472, by: 2.236, cx: 8.944, bPos: "above" },
        large: { bx: 6.88, by: 3.439, cx: 13.76, bPos: "above" },
      },
      // medium: (0,0)--(8,4)--(5,0)  AB[C]: obtuse angle at bottom-right
      2: {
        small: { bx: 4.923, by: 2.462, cx: 3.077, bPos: "above right" },
        medium: { bx: 8, by: 4, cx: 5, bPos: "above right" },
        large: { bx: 12.308, by: 6.154, cx: 7.692, bPos: "above right" },
      },
    },
  },
  scalene: {
    // medium: (0,0)--(1.54,2.57)--(5.83,0)  A[B]C: right angle at top
    right: {
      1: {
        small: { bx: 0.948, by: 1.581, cx: 3.588, bPos: "above" },
        medium: { bx: 1.54, by: 2.57, cx: 5.83, bPos: "above" },
        large: { bx: 2.369, by: 3.954, cx: 8.97, bPos: "above" },
      },
      // medium: (0,0)--(5,3)--(5,0)  AB[C]: right angle at bottom-right
      2: {
        small: { bx: 3.077, by: 1.846, cx: 3.077, bPos: "above right" },
        medium: { bx: 5, by: 3, cx: 5, bPos: "above right" },
        large: { bx: 7.692, by: 4.615, cx: 7.692, bPos: "above right" },
      },
    },
    // medium: (0,0)--(2.62,2.09)--(7.16,0)  A[B]C: obtuse angle at top
    obtuse: {
      1: {
        small: { bx: 1.612, by: 1.286, cx: 4.407, bPos: "above" },
        medium: { bx: 2.62, by: 2.09, cx: 7.16, bPos: "above" },
        large: { bx: 4.031, by: 3.215, cx: 11.015, bPos: "above" },
      },
      // medium: (0,0)--(6.5,3)--(5,0)  AB[C]: obtuse angle at bottom-right
      2: {
        small: { bx: 4.0, by: 1.846, cx: 3.077, bPos: "above right" },
        medium: { bx: 6.5, by: 3, cx: 5, bPos: "above right" },
        large: { bx: 10.0, by: 4.615, cx: 7.692, bPos: "above right" },
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
  const u1x = (p1x - vx) / d1,
    u1y = (p1y - vy) / d1;
  const u2x = (p2x - vx) / d2,
    u2y = (p2y - vy) / d2;
  const ax = f(vx + s * u1x),
    ay = f(vy + s * u1y);
  const bx = f(vx + s * u1x + s * u2x),
    by = f(vy + s * u1y + s * u2y);
  const cx = f(vx + s * u2x),
    cy = f(vy + s * u2y);
  return `\\draw[line width=1pt] (${ax},${ay}) -- (${bx},${by}) -- (${cx},${cy});`;
}

// Ray from (px,py) in direction (dx,dy) vs segment (ax,ay)→(bx2,by2). Returns {t,s} or null.
function raySegIntersect(px, py, dx, dy, ax, ay, bx2, by2) {
  const ex = bx2 - ax,
    ey = by2 - ay;
  const det = dx * -ey - dy * -ex;
  if (Math.abs(det) < 1e-10) return null;
  const fx = ax - px,
    fy = ay - py;
  const t = (fx * -ey - fy * -ex) / det;
  const s = (dx * fy - dy * fx) / det;
  return { t, s };
}

// Returns [i1, i2] indices into the labels array for the given side spec, or null.
// Vertex-pair notation: "AB" → indices of A and B.
// Traditional notation: "a" → indices of the two vertices opposite to "A".
function resolveSide(spec, labels) {
  if (spec.length === 2) {
    const i1 = labels.findIndex((v) => v.label === spec[0]);
    const i2 = labels.findIndex((v) => v.label === spec[1]);
    return i1 !== -1 && i2 !== -1 && i1 !== i2 ? [i1, i2] : null;
  }
  if (spec.length === 1 && /^[a-z]$/.test(spec)) {
    const opp = spec.toUpperCase();
    const idxs = labels.map((_, i) => i).filter((i) => labels[i].label !== opp);
    return idxs.length === 2 ? idxs : null;
  }
  return null;
}

// allPointNames (optional Set) broadens matching beyond triangle vertices.
function isAngleSpec(spec, vertexNames, allPointNames) {
  if (spec.startsWith("angle ")) {
    const name = spec.slice(6);
    return vertexNames.includes(name) || !!(allPointNames?.has(name));
  }
  const pts = allPointNames ?? new Set(vertexNames);
  return spec.length === 3 && spec.split("").every((c) => pts.has(c));
}

function normPos(p) {
  return p.replace("top", "above").replace("bottom", "below");
}

function isValidSideSpec(spec, vertexLabels) {
  if (spec.length === 2) {
    return (
      vertexLabels.includes(spec[0]) &&
      vertexLabels.includes(spec[1]) &&
      spec[0] !== spec[1]
    );
  }
  if (spec.length === 1 && /^[a-z]$/.test(spec)) {
    return vertexLabels.includes(spec.toUpperCase());
  }
  return false;
}

// --- Numeric triangle construction helpers ---

function computeRawTriVerts(mode, values) {
  const deg2rad = d => (d * Math.PI) / 180;
  if (mode === "SSS") {
    const [sAB, sBC, sCA] = values;
    const cosA = Math.max(-1, Math.min(1, (sAB * sAB + sCA * sCA - sBC * sBC) / (2 * sAB * sCA)));
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    return [{ x: 0, y: 0 }, { x: sAB, y: 0 }, { x: sCA * cosA, y: sCA * sinA }];
  }
  if (mode === "SAS") {
    const [s1, angleA, s2] = values;
    const r = deg2rad(angleA);
    return [{ x: 0, y: 0 }, { x: s1, y: 0 }, { x: s2 * Math.cos(r), y: s2 * Math.sin(r) }];
  }
  if (mode === "ASA") {
    const [angleA, sAB, angleB] = values;
    const angleC = 180 - angleA - angleB;
    const rA = deg2rad(angleA), rB = deg2rad(angleB), rC = deg2rad(angleC);
    const AC = (Math.sin(rC) > 1e-10) ? sAB * Math.sin(rB) / Math.sin(rC) : 0;
    return [{ x: 0, y: 0 }, { x: sAB, y: 0 }, { x: AC * Math.cos(rA), y: AC * Math.sin(rA) }];
  }
  if (mode === "AAS") {
    const [angleA, angleB, sideBC] = values;
    const angleC = 180 - angleA - angleB;
    const rA = deg2rad(angleA), rB = deg2rad(angleB), rC = deg2rad(angleC);
    const sinA = Math.sin(rA);
    const AB = sinA > 1e-10 ? sideBC * Math.sin(rC) / sinA : 0;
    const AC = sinA > 1e-10 ? sideBC * Math.sin(rB) / sinA : 0;
    return [{ x: 0, y: 0 }, { x: AB, y: 0 }, { x: AC * Math.cos(rA), y: AC * Math.sin(rA) }];
  }
  return null;
}

const TRI_LONGEST_TARGET = { small: 3.1, medium: 5.0, large: 7.7 };

function scaleTriVerts(pts, size) {
  const sides = [
    Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
    Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y),
    Math.hypot(pts[0].x - pts[2].x, pts[0].y - pts[2].y),
  ];
  const maxSide = Math.max(...sides);
  if (maxSide < 1e-10) return pts;
  const scale = TRI_LONGEST_TARGET[size] / maxSide;
  return pts.map(p => ({ x: p.x * scale, y: p.y * scale }));
}

// Rotate all points clockwise by angleDeg.
function rotVertsBy(pts, angleDeg) {
  const rad = (-angleDeg * Math.PI) / 180;
  return pts.map(p => ({
    x: p.x * Math.cos(rad) - p.y * Math.sin(rad),
    y: p.x * Math.sin(rad) + p.y * Math.cos(rad),
  }));
}

// Translate/rotate so pts[i1] is at origin and pts[i2] is on positive x-axis.
// Flips vertically if the third vertex ends up below the x-axis.
function sideToHorizontal(pts, i1, i2) {
  const ox = pts[i1].x, oy = pts[i1].y;
  let tpts = pts.map(p => ({ x: p.x - ox, y: p.y - oy }));
  const angleDeg = (Math.atan2(tpts[i2].y, tpts[i2].x) * 180) / Math.PI;
  tpts = rotVertsBy(tpts, angleDeg);
  const i3 = [0, 1, 2].find(i => i !== i1 && i !== i2);
  if (tpts[i3].y < 0) tpts = tpts.map(p => ({ x: p.x, y: -p.y }));
  return tpts;
}

function applyTriTransforms(pts, transforms) {
  let cur = pts.map(p => ({ ...p }));
  const sideVerts = [[0, 1], [1, 2], [2, 0]];
  let baseIdx = 0;

  for (const t of transforms) {
    if (t.type === "invert") {
      cur = cur.map(p => ({ x: -p.x, y: p.y }));
    } else if (t.type === "rot" && t.degrees === null) {
      baseIdx = (baseIdx + 1) % 3;
      const [i1, i2] = sideVerts[baseIdx];
      cur = sideToHorizontal(cur, i1, i2);
    } else if (t.type === "rot") {
      cur = rotVertsBy(cur, t.degrees);
    }
  }

  const minY = Math.min(...cur.map(p => p.y));
  const minX = Math.min(...cur.map(p => p.x));
  return cur.map(p => ({ x: p.x - minX, y: p.y - minY }));
}

// Medium-size vertices [A,B,C,D] for each quad type. Scaled ×0.75 for small, ×1.375 for large.
// Clockwise from bottom-left: A=bottom-left, B=top-left, C=top-right, D=bottom-right.
const QUAD_VERTS = {
  square:                [[0,0],[0,4],[4,4],[4,0]],
  rectangle:             [[0,0],[0,3],[5.5,3],[5.5,0]],
  parallelogram:         [[0,0],[1.5,3],[6.5,3],[5,0]],
  rhombus:               [[0,0],[1.368,3.759],[5.368,3.759],[4,0]],
  trapezoid:             [[0,0],[0.5,3],[4,3],[5,0]],
  "right trapezoid":     [[0,0],[0,3],[3.5,3],[5,0]],
  "isosceles trapezoid": [[0,0],[1,3],[4,3],[5,0]],
};
const QUAD_SCALE = { small: 0.75, medium: 1.0, large: 1.375 };

function applyQuadTransforms(pts, transforms) {
  let cur = pts.map(p => ({ ...p }));
  const sideVerts = [[0, 1], [1, 2], [2, 3], [3, 0]];
  let baseIdx = 0;

  for (const t of transforms) {
    if (t.type === "invert") {
      cur = cur.map(p => ({ x: -p.x, y: p.y }));
    } else if (t.type === "rot" && t.degrees === null) {
      baseIdx = (baseIdx + 1) % 4;
      const [i1, i2] = sideVerts[baseIdx];
      cur = sideToHorizontal(cur, i1, i2);
    } else if (t.type === "rot") {
      cur = rotVertsBy(cur, t.degrees);
    }
  }

  const minY = Math.min(...cur.map(p => p.y));
  const minX = Math.min(...cur.map(p => p.x));
  return cur.map(p => ({ x: p.x - minX, y: p.y - minY }));
}

function quadLabelPos(x, y, cx, cy) {
  const dy = y - cy, dx = x - cx;
  const vert = dy >= 0 ? "above" : "below";
  const horiz = dx <= 0 ? " left" : " right";
  return vert + horiz;
}

function computeQuadPositions(quadType, quadTransforms, size) {
  const scale = QUAD_SCALE[size];
  const verts = QUAD_VERTS[quadType] ?? QUAD_VERTS.square;
  const raw = verts.map(([x, y]) => ({ x: x * scale, y: y * scale }));
  const transformed = applyQuadTransforms(raw, quadTransforms);
  const cx = transformed.reduce((acc, p) => acc + p.x, 0) / 4;
  const cy = transformed.reduce((acc, p) => acc + p.y, 0) / 4;
  return transformed.map(p => ({ x: p.x, y: p.y, pos: quadLabelPos(p.x, p.y, cx, cy) }));
}

function triLabelPos(x, y, cx, cy) {
  const dy = y - cy, dx = x - cx;
  const vert = dy > 0.1 ? "above" : "below";
  const horiz = dx < -0.2 ? " left" : dx > 0.2 ? " right" : "";
  return vert + horiz;
}

function computeTrianglePositions(triMode, triValues, triTransforms, size) {
  const raw = computeRawTriVerts(triMode, triValues);
  if (!raw) return null;
  const scaled = scaleTriVerts(raw, size);
  const transformed = applyTriTransforms(scaled, triTransforms);
  const cx = (transformed[0].x + transformed[1].x + transformed[2].x) / 3;
  const cy = (transformed[0].y + transformed[1].y + transformed[2].y) / 3;
  return transformed.map(p => ({ x: p.x, y: p.y, pos: triLabelPos(p.x, p.y, cx, cy) }));
}

// Splits content (any whitespace layout) into command chunks by keyword boundaries.
function parseContent(content) {
  const lines = content
    .trim()
    .split(/(?<=\s)(?=(?:triangle|quadrilateral|label|mark|line|point|circle)\b)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const hasTriangle = (lines[0] || "").split(/\s+/)[0] === "triangle";
  const hasQuad = (lines[0] || "").split(/\s+/)[0] === "quadrilateral";
  const triangleResult = hasTriangle
    ? parseTriangle(lines[0] || "")
    : { angle: null, side: null, unknown: [], labelStr: null, triMode: null, triValues: null, triTransforms: [] };
  const quadResult = hasQuad
    ? parseQuadrilateral(lines[0] || "")
    : { quadType: null, labelStr: null, quadTransforms: [], unknown: [] };
  const commandLines = lines.slice(hasTriangle || hasQuad ? 1 : 0);

  const vertexNames = hasTriangle
    ? (
        parseLabels(triangleResult.labelStr) ?? [
          { label: "A" },
          { label: "B" },
          { label: "C" },
        ]
      ).map((v) => v.label)
    : hasQuad
    ? (
        parseQuadLabels(quadResult.labelStr) ?? [
          { label: "A" },
          { label: "B" },
          { label: "C" },
          { label: "D" },
        ]
      ).map((v) => v.label)
    : [];

  const vertexLabelCmds = [];
  const angleLabelCmds = [];
  const sideLabelCmds = [];
  const markCmds = [];
  const lineCmds = [];
  const pointCmds = [];
  const circlePointCmds = [];
  const intersectPointCmds = [];
  const drawCmds = [];
  const circleCmds = [];
  const inscribedCircleCmds = [];
  const circumscribedCircleCmds = [];
  const tangentLineCmds = [];
  const extraErrors = [];
  if (hasQuad && quadResult.unknown.length > 0)
    extraErrors.push(`Unknown modifier(s): ${quadResult.unknown.map(w => `"${w}"`).join(", ")}`);

  // Pre-scan new point names so "label"/"mark" can reference them.
  const lineNewNames = new Set();
  const pointNewNames = new Set();
  const circleNewNames = new Set();
  for (const chunk of commandLines) {
    const ws = chunk.trim().split(/\s+/);
    if (ws[0] === "line") {
      const ni = ws.indexOf("new");
      if (ni !== -1) ws.slice(ni + 1).forEach((n) => lineNewNames.add(n));
    } else if (ws[0] === "point") {
      if (ws[2] === "intersect" && ws.length >= 6) {
        pointNewNames.add(ws[5]);
      } else if (ws.length >= 5 && ws[3] === "new") {
        pointNewNames.add(ws[4]);
      }
    } else if (ws[0] === "circle") {
      const isSpec = ws[1] === "inscribe" || ws[1] === "circumscribe";
      const ni = isSpec ? ws.indexOf("new") : -1;
      const nm = isSpec ? (ni !== -1 ? (ws[ni + 1] ?? "") : "") : (ws[1] || "O-OX");
      const d = nm.indexOf("-");
      if (d > 0) {
        const ctr = nm.slice(0, d);
        const rs = nm.slice(d + 1);
        const np = rs.startsWith(ctr) ? rs.slice(ctr.length) : rs;
        circleNewNames.add(ctr);
        if (np) circleNewNames.add(np);
      }
      if (isSpec && ni !== -1) ws.slice(ni + 2).forEach((n) => circleNewNames.add(n));
    }
  }
  const allPointNames = new Set([
    ...vertexNames,
    ...lineNewNames,
    ...pointNewNames,
    ...circleNewNames,
  ]);

  for (const line of commandLines) {
    const words = line.split(/\s+/);
    if (words[0] === "label") {
      if (words.length < 2) {
        extraErrors.push(
          `"label" requires at least a specification: "${line}"`,
        );
      } else {
        let i = 1;
        let spec;
        if (words[i] === "angle" && i + 1 < words.length) {
          spec = "angle " + words[i + 1];
          i += 2;
        } else {
          spec = words[i];
          i++;
        }
        let bigger = false;
        if (isAngleSpec(spec, vertexNames, allPointNames) && words[i] === "bigger") {
          bigger = true;
          i++;
        }
        const remainingWords = words.slice(i);
        const dashIdx = remainingWords.indexOf("--");
        const textWords =
          dashIdx !== -1 ? remainingWords.slice(0, dashIdx) : remainingWords;
        const posWords =
          dashIdx !== -1 ? remainingWords.slice(dashIdx + 1) : [];

        if (allPointNames.has(spec)) {
          const labelPos =
            posWords.length > 0 ? normPos(posWords.join(" ")) : null;
          const text = textWords.length > 0 ? textWords.join(" ") : null;
          vertexLabelCmds.push({ spec, text, labelPos });
        } else if (isAngleSpec(spec, vertexNames, allPointNames)) {
          const text = textWords.length > 0 ? textWords.join(" ") : null;
          angleLabelCmds.push({ spec, bigger, text });
        } else {
          const labelSide = posWords.length > 0 ? posWords[0] : null;
          const labelText = textWords.length > 0 ? textWords.join(" ") : null;
          sideLabelCmds.push({ sideSpec: spec, labelText, labelSide });
        }
      }
    } else if (words[0] === "mark") {
      if (words.length < 2) {
        extraErrors.push(`"mark" requires at least a specification: "${line}"`);
      } else {
        let i = 1;
        let spec;
        if (words[i] === "angle" && i + 1 < words.length) {
          spec = "angle " + words[i + 1];
          i += 2;
        } else {
          spec = words[i];
          i++;
        }
        if (
          vertexNames.includes(spec) ||
          pointNewNames.has(spec) ||
          circleNewNames.has(spec)
        ) {
          markCmds.push({ type: "vertex", spec });
        } else if (isAngleSpec(spec, vertexNames, allPointNames)) {
          let arcs = null,
            isRight = false;
          if (i < words.length && words[i] === "right") {
            isRight = true;
            i++;
          } else if (i < words.length && /^I+$/.test(words[i])) {
            arcs = words[i].length;
            i++;
          }
          markCmds.push({ type: "angle", spec, arcs, isRight });
        } else {
          let ticks = null;
          if (i < words.length && /^I+$/.test(words[i])) {
            ticks = words[i].length;
            i++;
          }
          markCmds.push({ type: "side", spec, ticks });
        }
      }
    } else if (words[0] === "point") {
      if (words.length >= 5 && words[2] === "intersect") {
        if (words.length < 6 || words[4] !== "new") {
          extraErrors.push(
            `"point": intersect format requires "point AB intersect CD new K"`,
          );
        } else {
          intersectPointCmds.push({ spec1: words[1], spec2: words[3], name: words[5] });
        }
      } else if (words.length < 5 || words[3] !== "new") {
        extraErrors.push(
          `"point" requires: side ratio new name (e.g. "point KL 1:4 new H"), circle angle new name (e.g. "point O-OX -120 new G"), or side intersect side new name (e.g. "point AB intersect CD new K")`,
        );
      } else {
        const spec = words[1];
        const value = words[2];
        const name = words[4];
        if (spec.includes("-")) {
          circlePointCmds.push({ circleName: spec, angleStr: value, name });
        } else {
          pointCmds.push({ sideSpec: spec, ratioStr: value, name });
        }
      }
    } else if (words[0] === "line") {
      if (words[1] === "segment" || words[1] === "ray") {
        drawCmds.push({ drawType: words[1], pts: words[2] ?? "" });
      } else if (words[1] && words[1].length === 2) {
        drawCmds.push({ drawType: "line", pts: words[1] });
      } else if (words[1] === "tangent") {
        if (words.length < 6 || words[4] !== "new") {
          extraErrors.push(`"line tangent": format is "line tangent <circle> <point> new <name>"`);
        } else {
          tangentLineCmds.push({ circleName: words[2], pointName: words[3], newName: words[5] });
        }
      } else {
        let i = 1;
        let lineType = null;
        if (words[i] === "perpendicular" && words[i + 1] === "bisector") {
          lineType = "perpendicular bisector";
          i += 2;
        } else if (words[i] === "angle" && words[i + 1] === "bisector") {
          lineType = "angle bisector";
          i += 2;
        } else if (words[i] === "median") {
          lineType = "median";
          i++;
        } else if (words[i] === "altitude") {
          lineType = "altitude";
          i++;
        } else if (words[i] === "midsegment") {
          lineType = "midsegment";
          i++;
        }
        if (!lineType) {
          extraErrors.push(`Unknown line type in: "${line}"`);
        } else {
          const triangleSpec = words[i++] ?? "";
          const specWords = [];
          while (i < words.length && words[i] !== "new")
            specWords.push(words[i++]);
          if (words[i] !== "new") {
            extraErrors.push(`"line ${lineType}": missing "new" keyword`);
          } else {
            lineCmds.push({
              lineType,
              triangleSpec,
              specWords,
              newNames: words.slice(i + 1),
            });
          }
        }
      }
    } else if (words[0] === "circle") {
      if (words[1] === "inscribe" || words[1] === "circumscribe") {
        const circleType = words[1];
        const ni = words.indexOf("new");
        if (ni === -1 || !words[ni + 1]) {
          extraErrors.push(`"circle ${circleType}": missing "new <circleName>"`);
        } else {
          const triSpec = words[2] ?? "";
          const circleName = words[ni + 1];
          const dash = circleName.indexOf("-");
          if (dash <= 0 || dash === circleName.length - 1) {
            extraErrors.push(`"circle ${circleType}": invalid circle name "${circleName}" — expected "center-radiusSide"`);
          } else {
            const center = circleName.slice(0, dash);
            const radiusSide = circleName.slice(dash + 1);
            const northPt = radiusSide.startsWith(center) ? radiusSide.slice(center.length) : radiusSide;
            if (circleType === "inscribe") {
              inscribedCircleCmds.push({ triSpec, circleName, center, northPt, touchNames: words.slice(ni + 2) });
            } else {
              circumscribedCircleCmds.push({ triSpec, circleName, center, northPt });
            }
          }
        }
      } else {
        const name = words[1] || "O-OX";
        const dash = name.indexOf("-");
        if (dash <= 0 || dash === name.length - 1) {
          extraErrors.push(
            `"circle": invalid format "${name}" — expected "center-radiusSide" (e.g. "O-OX")`,
          );
        } else {
          const center = name.slice(0, dash);
          const radiusSide = name.slice(dash + 1);
          const northPt = radiusSide.startsWith(center)
            ? radiusSide.slice(center.length)
            : radiusSide;
          circleCmds.push({ name, center, radiusSide, northPt });
        }
      }
    } else {
      extraErrors.push(`Unknown command: "${line}"`);
    }
  }

  return {
    ...triangleResult,
    vertexLabelCmds,
    angleLabelCmds,
    sideLabelCmds,
    markCmds,
    lineCmds,
    pointCmds,
    circlePointCmds,
    intersectPointCmds,
    drawCmds,
    circleCmds,
    inscribedCircleCmds,
    circumscribedCircleCmds,
    tangentLineCmds,
    hasTriangle,
    hasQuad,
    quadResult,
    extraErrors,
  };
}

function syntaxCheck(content) {
  const errors = [];
  const {
    angle,
    side,
    unknown,
    labelStr,
    triMode,
    triValues,
    angleLabelCmds,
    sideLabelCmds,
    lineCmds,
    pointCmds,
    circlePointCmds,
    intersectPointCmds,
    drawCmds,
    circleCmds,
    inscribedCircleCmds,
    circumscribedCircleCmds,
    tangentLineCmds,
    hasTriangle,
    hasQuad,
    quadResult,
    extraErrors,
  } = parseContent(content);

  const firstCmd = content.trim().split(/\s+/)[0] || "";
  if (firstCmd !== "triangle" && firstCmd !== "circle" && firstCmd !== "quadrilateral") {
    return {
      valid: false,
      errors: [`Unknown shape. Only "triangle", "quadrilateral", and "circle" are supported.`],
    };
  }

  if (unknown.length > 0) {
    errors.push(
      `Unknown modifier(s): ${unknown.map((w) => `"${w}"`).join(", ")}`,
    );
  }

  if (hasTriangle && triMode === null) {
    const w1 = (content.trim().split(/\s+/)[1] ?? "");
    if (w1.length >= 2 && /^[SA]+$/.test(w1)) {
      errors.push(`"triangle ${w1}": invalid combination — use SSS, SAS, ASA, or AAS`);
    }
  }

  if (triMode !== null) {
    if (!triValues || triValues.length < 3 || triValues.some(v => isNaN(v) || v <= 0)) {
      errors.push(`"triangle ${triMode}": expected 3 positive numbers`);
    } else {
      if (triMode === "SSS") {
        const [a, b, c] = triValues;
        if (a + b <= c || a + c <= b || b + c <= a)
          errors.push(`"triangle SSS": triangle inequality violated`);
      } else if (triMode === "SAS") {
        const ang = triValues[1];
        if (ang <= 0 || ang >= 180)
          errors.push(`"triangle SAS": angle must be between 0 and 180 degrees (exclusive)`);
      } else if (triMode === "ASA") {
        const [a1, , a2] = triValues;
        if (a1 <= 0 || a2 <= 0 || a1 + a2 >= 180)
          errors.push(`"triangle ASA": angles must be positive and sum to less than 180`);
      } else if (triMode === "AAS") {
        const [a1, a2] = triValues;
        if (a1 <= 0 || a2 <= 0 || a1 + a2 >= 180)
          errors.push(`"triangle AAS": angles must be positive and sum to less than 180`);
      }
    }
  }

  if (!triMode && side === "equilateral" && angle === "right")
    errors.push("Equilateral triangles cannot be right-angled.");
  if (!triMode && side === "equilateral" && angle === "obtuse")
    errors.push("Equilateral triangles cannot be obtuse.");

  if (hasTriangle && labelStr !== null) {
    const parsed = parseLabels(labelStr);
    if (!parsed) {
      errors.push(`Invalid label specification: "${labelStr}"`);
    } else if (parsed.filter((v) => v.mod === "mark").length > 1) {
      errors.push("Only one vertex can be marked with [].");
    }
  }

  if (hasQuad) {
    if (!quadResult.quadType) {
      errors.push(`"quadrilateral": shape type required (e.g., "square", "rectangle", "parallelogram", "rhombus", "trapezoid", "right trapezoid", "isosceles trapezoid")`);
    }
    if (quadResult.labelStr !== null) {
      const parsed = parseQuadLabels(quadResult.labelStr);
      if (!parsed) errors.push(`Invalid label specification: "${quadResult.labelStr}"`);
    }
  }

  errors.push(...extraErrors);

  const vertexNames = hasQuad
    ? (
        parseQuadLabels(quadResult.labelStr) ?? [
          { label: "A" }, { label: "B" }, { label: "C" }, { label: "D" },
        ]
      ).map((v) => v.label)
    : (
        parseLabels(labelStr) ?? [{ label: "A" }, { label: "B" }, { label: "C" }]
      ).map((v) => v.label);

  const circleKnownNames = [];
  for (const { center, northPt } of circleCmds) {
    circleKnownNames.push(center);
    if (northPt) circleKnownNames.push(northPt);
  }
  for (const { center, northPt, touchNames } of inscribedCircleCmds) {
    circleKnownNames.push(center);
    if (northPt) circleKnownNames.push(northPt);
    touchNames.forEach((n) => circleKnownNames.push(n));
  }
  for (const { center, northPt } of circumscribedCircleCmds) {
    circleKnownNames.push(center);
    if (northPt) circleKnownNames.push(northPt);
  }
  const allKnownNames = new Set([
    ...vertexNames,
    ...pointCmds.map((c) => c.name),
    ...circlePointCmds.map((c) => c.name),
    ...intersectPointCmds.map((c) => c.name),
    ...circleKnownNames,
    ...lineCmds.flatMap((c) => c.newNames ?? []),
    ...tangentLineCmds.map((c) => c.newName),
  ]);

  for (const { spec } of angleLabelCmds) {
    if (!isAngleSpec(spec, vertexNames, allKnownNames)) {
      errors.push(`Invalid angle specification: "${spec}"`);
    }
  }

  for (const { sideSpec } of sideLabelCmds) {
    const validTriangle = isValidSideSpec(sideSpec, vertexNames);
    const validSegment =
      sideSpec.length === 2 &&
      allKnownNames.has(sideSpec[0]) &&
      allKnownNames.has(sideSpec[1]) &&
      sideSpec[0] !== sideSpec[1];
    if (!validTriangle && !validSegment) {
      errors.push(`Invalid side specification: "${sideSpec}"`);
    }
  }
  for (const { drawType, pts } of drawCmds) {
    if (!pts || pts.length < 2) {
      errors.push(`"line ${drawType}": expects two point names (e.g. "KL")`);
    } else if (pts[0] === pts[1]) {
      errors.push(`"line ${drawType}": both points must be different`);
    } else if (!allKnownNames.has(pts[0]) || !allKnownNames.has(pts[1])) {
      errors.push(`"line ${drawType}": unknown point(s) in "${pts}"`);
    }
  }

  for (const { sideSpec, ratioStr, name } of pointCmds) {
    if (!isValidSideSpec(sideSpec, vertexNames)) {
      errors.push(`"point": invalid side "${sideSpec}"`);
    }
    const parts = ratioStr.split(":");
    if (parts.length !== 2 || parts.some((p) => isNaN(+p) || +p <= 0)) {
      errors.push(
        `"point": invalid ratio "${ratioStr}" (expected positive numbers, e.g. "1:4")`,
      );
    }
    if (!name || !/^\S+$/.test(name)) {
      errors.push(`"point": invalid name "${name}"`);
    }
  }

  for (const { circleName, angleStr, name } of circlePointCmds) {
    if (!circleCmds.some((c) => c.name === circleName)) {
      errors.push(`"point": unknown circle "${circleName}"`);
    }
    if (isNaN(parseFloat(angleStr))) {
      errors.push(
        `"point": invalid angle "${angleStr}" — expected a number (e.g. -120)`,
      );
    }
    if (!name || !/^\S+$/.test(name)) {
      errors.push(`"point": invalid name "${name}"`);
    }
  }

  for (const { spec1, spec2, name } of intersectPointCmds) {
    for (const seg of [spec1, spec2]) {
      if (
        seg.length !== 2 ||
        !allKnownNames.has(seg[0]) ||
        !allKnownNames.has(seg[1]) ||
        seg[0] === seg[1]
      ) {
        errors.push(`"point intersect": invalid segment "${seg}" — expected two known point names`);
      }
    }
    if (!name || !/^\S+$/.test(name)) {
      errors.push(`"point intersect": invalid name "${name}"`);
    }
  }

  for (const { circleName, pointName, newName } of tangentLineCmds) {
    if (!circleCmds.some((c) => c.name === circleName)) {
      errors.push(`"line tangent": unknown circle "${circleName}"`);
    }
    if (!allKnownNames.has(pointName)) {
      errors.push(`"line tangent": unknown point "${pointName}"`);
    }
    if (!newName || !/^\S+$/.test(newName)) {
      errors.push(`"line tangent": invalid name "${newName}"`);
    }
  }

  for (const { triSpec, circleName, touchNames } of inscribedCircleCmds) {
    const tvChars = (triSpec ?? "").split("");
    if (tvChars.length !== 3 || !tvChars.every((c) => vertexNames.includes(c)))
      errors.push(`"circle inscribe": invalid triangle spec "${triSpec}"`);
    if (touchNames.length !== 0 && touchNames.length !== 3)
      errors.push(`"circle inscribe": expects 0 or 3 touch point names after circle name, got ${touchNames.length}`);
    touchNames.forEach((n) => {
      if (!n || !/^\S+$/.test(n)) errors.push(`"circle inscribe": invalid touch point name "${n}"`);
    });
  }

  for (const { triSpec } of circumscribedCircleCmds) {
    const tvChars = (triSpec ?? "").split("");
    if (tvChars.length !== 3 || !tvChars.every((c) => vertexNames.includes(c)))
      errors.push(`"circle circumscribe": invalid triangle spec "${triSpec}"`);
  }

  for (const { lineType, triangleSpec, specWords, newNames } of lineCmds) {
    const tvChars = (triangleSpec ?? "").split("");
    if (
      tvChars.length !== 3 ||
      !tvChars.every((c) => vertexNames.includes(c))
    ) {
      errors.push(
        `"line ${lineType}": invalid triangle spec "${triangleSpec}"`,
      );
      continue;
    }
    const isVertexCh = (c) => tvChars.includes(c);
    const isSideCh = (s) =>
      s.length === 2 && isVertexCh(s[0]) && isVertexCh(s[1]);
    if (lineType === "perpendicular bisector") {
      if (specWords.length !== 1 || !isSideCh(specWords[0]))
        errors.push(
          `"line perpendicular bisector": expects a side (e.g., "KL") before "new"`,
        );
      if (newNames.length !== 2)
        errors.push(`"line perpendicular bisector": expects 2 new point names`);
    } else if (lineType === "angle bisector") {
      if (specWords.length !== 0)
        errors.push(`"line angle bisector": expects nothing before "new"`);
      if (newNames.length !== 2 || !isVertexCh(newNames[0]))
        errors.push(`"line angle bisector": expects "new <vertex> <point>"`);
    } else if (lineType === "median" || lineType === "altitude") {
      if (specWords.length !== 1 || !isVertexCh(specWords[0]))
        errors.push(`"line ${lineType}": expects a vertex before "new"`);
      if (newNames.length !== 1)
        errors.push(`"line ${lineType}": expects 1 new point name`);
    } else if (lineType === "midsegment") {
      if (
        specWords.length !== 2 ||
        !isSideCh(specWords[0]) ||
        !isSideCh(specWords[1])
      )
        errors.push(`"line midsegment": expects two sides before "new"`);
      if (newNames.length !== 2)
        errors.push(`"line midsegment": expects 2 new point names`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function compile(content, size) {
  const {
    angle: rawAngle,
    side: rawSide,
    labelStr,
    triMode,
    triValues,
    triTransforms,
    vertexLabelCmds,
    angleLabelCmds,
    sideLabelCmds,
    markCmds,
    lineCmds,
    pointCmds,
    circlePointCmds,
    intersectPointCmds,
    drawCmds,
    circleCmds,
    inscribedCircleCmds,
    circumscribedCircleCmds,
    tangentLineCmds,
    hasTriangle,
    hasQuad,
    quadResult,
  } = parseContent(content);

  // Labels map directly by position order. No mark = use DEFAULT_SPECIAL_POS.
  const labels = hasTriangle
    ? (parseLabels(labelStr) ?? [
        { label: "A", mod: "none" },
        { label: "B", mod: "none" },
        { label: "C", mod: "none" },
      ])
    : hasQuad
    ? (parseQuadLabels(quadResult.labelStr) ?? [
        { label: "A", mod: "none" },
        { label: "B", mod: "none" },
        { label: "C", mod: "none" },
        { label: "D", mod: "none" },
      ])
    : [];

  let positions;
  if (triMode) {
    const computed = computeTrianglePositions(triMode, triValues, triTransforms, size);
    positions = computed ?? [
      { x: 0, y: 0, pos: "below left" },
      { x: 2.5, y: 4, pos: "above" },
      { x: 5, y: 0, pos: "below right" },
    ];
  } else if (hasTriangle) {
    const angle = rawAngle ?? "acute";
    const side = rawSide ?? "scalene";
    const markedIdx = labels.findIndex((v) => v.mod === "mark");
    const specialPos =
      markedIdx !== -1 ? markedIdx : (DEFAULT_SPECIAL_POS[side]?.[angle] ?? 0);
    const altSizeMap = COORDS_ALT[side]?.[angle]?.[specialPos];
    const { bx, by, cx, bPos } = (altSizeMap ?? COORDS[side][angle])[size];
    positions = [
      { x: 0, y: 0, pos: "below left" },
      { x: bx, y: by, pos: bPos },
      { x: cx, y: 0, pos: "below right" },
    ];
  } else if (hasQuad) {
    positions = computeQuadPositions(quadResult.quadType, quadResult.quadTransforms, size);
  } else {
    positions = [];
  }

  // Shared size-scaled mark/arc constants (used by both angle labels and mark rendering).
  const arcBase = { small: 0.215, medium: 0.35, large: 0.539 }[size];
  const arcGap = { small: 0.092, medium: 0.15, large: 0.231 }[size];

  // Pre-resolve mark auto-counts so angle labels can look up the final arc count.
  let _segCtr = 0,
    _arcCtr = 0;
  const resolvedMarks = markCmds.map((cmd) => {
    if (cmd.type === "side" && cmd.ticks === null)
      return { ...cmd, ticks: ++_segCtr };
    if (cmd.type === "angle" && !cmd.isRight && cmd.arcs === null)
      return { ...cmd, arcs: ++_arcCtr };
    return cmd;
  });

  // Shape centroid + label offset for new points (shared by vertex labels & line rendering).
  const centX = positions.length > 0 ? positions.reduce((s, p) => s + p.x, 0) / positions.length : 0;
  const centY = positions.length > 0 ? positions.reduce((s, p) => s + p.y, 0) / positions.length : 0;
  const ptLblOff = { small: 0.26, medium: 0.36, large: 0.55 }[size];
  const ptCmdLblOff = { small: 0.38, medium: 0.53, large: 0.82 }[size];
  const pointCmdByName = Object.fromEntries(pointCmds.map((c) => [c.name, c]));
  const lookupPt = (name) => {
    const idx = labels.findIndex((v) => v.label === name);
    return idx !== -1 ? positions[idx] : (newPtsMap[name] ?? null);
  };
  const resolveAngleCoords = (spec) => {
    let vertLabel, adj1Label, adj2Label;
    if (spec.startsWith("angle ")) {
      vertLabel = spec.slice(6);
      const vertIdx = labels.findIndex((v) => v.label === vertLabel);
      if (vertIdx !== -1) {
        const others = labels.filter((v) => v.label !== vertLabel);
        if (others.length < 2) return null;
        [adj1Label, adj2Label] = [others[0].label, others[1].label];
      } else {
        // Non-triangle vertex: find two explicit draw segments through it.
        const segs = drawCmds.filter(
          (d) => d.pts[0] === vertLabel || d.pts[1] === vertLabel,
        );
        if (segs.length < 2) return null;
        adj1Label = segs[0].pts[0] === vertLabel ? segs[0].pts[1] : segs[0].pts[0];
        adj2Label = segs[1].pts[0] === vertLabel ? segs[1].pts[1] : segs[1].pts[0];
      }
    } else {
      [adj1Label, vertLabel, adj2Label] = [spec[0], spec[1], spec[2]];
    }
    const vpt = lookupPt(vertLabel);
    const a1pt = lookupPt(adj1Label);
    const a2pt = lookupPt(adj2Label);
    if (!vpt || !a1pt || !a2pt) return null;
    return { vx: vpt.x, vy: vpt.y, a1x: a1pt.x, a1y: a1pt.y, a2x: a2pt.x, a2y: a2pt.y };
  };

  // Pre-compute geometry for all line commands (positions of new points + segment endpoints).
  const newPtsMap = {};
  const lineGeoms = lineCmds.map(
    ({ lineType, triangleSpec, specWords, newNames }) => {
      const vp = {};
      for (const ch of triangleSpec) {
        const idx = labels.findIndex((l) => l.label === ch);
        if (idx !== -1) vp[ch] = positions[idx];
      }
      let p1 = null,
        p2 = null;
      const pts = {};
      if (lineType === "perpendicular bisector") {
        const side = specWords[0];
        const A = vp[side[0]],
          B = vp[side[1]];
        const C =
          vp[
            triangleSpec.split("").find((c) => c !== side[0] && c !== side[1])
          ];
        const G = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
        let dx = -(B.y - A.y),
          dy = B.x - A.x;
        if (dx * (C.x - G.x) + dy * (C.y - G.y) < 0) {
          dx = -dx;
          dy = -dy;
        }
        let H = null;
        for (const [Sa, Sb] of [
          [A, C],
          [B, C],
        ]) {
          const r = raySegIntersect(G.x, G.y, dx, dy, Sa.x, Sa.y, Sb.x, Sb.y);
          if (r && r.t > 1e-6 && r.s >= -1e-6 && r.s <= 1 + 1e-6) {
            H = { x: G.x + r.t * dx, y: G.y + r.t * dy };
            break;
          }
        }
        p1 = G;
        p2 = H;
        if (newNames[0]) pts[newNames[0]] = G;
        if (newNames[1] && H) pts[newNames[1]] = H;
      } else if (lineType === "angle bisector") {
        const V = vp[newNames[0]];
        const [oCh1, oCh2] = triangleSpec
          .split("")
          .filter((c) => c !== newNames[0]);
        const L = vp[oCh1],
          M = vp[oCh2];
        const dVL = Math.hypot(L.x - V.x, L.y - V.y),
          dVM = Math.hypot(M.x - V.x, M.y - V.y);
        const G = {
          x: L.x + (dVL / (dVL + dVM)) * (M.x - L.x),
          y: L.y + (dVL / (dVL + dVM)) * (M.y - L.y),
        };
        p1 = V;
        p2 = G;
        if (newNames[0]) pts[newNames[0]] = V;
        if (newNames[1]) pts[newNames[1]] = G;
      } else if (lineType === "median") {
        const V = vp[specWords[0]];
        const [oCh1, oCh2] = triangleSpec
          .split("")
          .filter((c) => c !== specWords[0]);
        const L = vp[oCh1],
          M = vp[oCh2];
        const G = { x: (L.x + M.x) / 2, y: (L.y + M.y) / 2 };
        p1 = V;
        p2 = G;
        if (newNames[0]) pts[newNames[0]] = G;
      } else if (lineType === "altitude") {
        const V = vp[specWords[0]];
        const [oCh1, oCh2] = triangleSpec
          .split("")
          .filter((c) => c !== specWords[0]);
        const L = vp[oCh1],
          M = vp[oCh2];
        const ex = M.x - L.x,
          ey = M.y - L.y;
        const t = ((V.x - L.x) * ex + (V.y - L.y) * ey) / (ex * ex + ey * ey);
        const G = { x: L.x + t * ex, y: L.y + t * ey };
        p1 = V;
        p2 = G;
        if (newNames[0]) pts[newNames[0]] = G;
      } else if (lineType === "midsegment") {
        const s1 = specWords[0],
          s2 = specWords[1];
        const G = {
          x: (vp[s1[0]].x + vp[s1[1]].x) / 2,
          y: (vp[s1[0]].y + vp[s1[1]].y) / 2,
        };
        const H = {
          x: (vp[s2[0]].x + vp[s2[1]].x) / 2,
          y: (vp[s2[0]].y + vp[s2[1]].y) / 2,
        };
        p1 = G;
        p2 = H;
        if (newNames[0]) pts[newNames[0]] = G;
        if (newNames[1]) pts[newNames[1]] = H;
      }
      Object.assign(newPtsMap, pts);
      return { p1, p2 };
    },
  );

  // Compute positions for explicit points on sides.
  for (const { sideSpec, ratioStr, name } of pointCmds) {
    const [r1, r2] = ratioStr.split(":").map(Number);
    const t = r1 / (r1 + r2);
    const i1 = labels.findIndex((v) => v.label === sideSpec[0]);
    const i2 = labels.findIndex((v) => v.label === sideSpec[1]);
    if (i1 !== -1 && i2 !== -1) {
      const p1 = positions[i1],
        p2 = positions[i2];
      newPtsMap[name] = {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
      };
    }
  }

  // Circle point positions must be in newPtsMap before draw commands run.
  const circleR = { small: 1.5, medium: 2.0, large: 3.8 }[size];
  for (const { center, northPt } of circleCmds) {
    newPtsMap[center] = { x: 0, y: 0, pos: "below" };
    if (northPt) newPtsMap[northPt] = { x: circleR, y: 0, pos: "right" };
  }

  // Compute positions for explicit points on circles.
  for (const { circleName, angleStr, name } of circlePointCmds) {
    const circleCmd = circleCmds.find((c) => c.name === circleName);
    if (!circleCmd) continue;
    const center = newPtsMap[circleCmd.center];
    if (!center) continue;
    const rad = (parseFloat(angleStr) * Math.PI) / 180;
    newPtsMap[name] = {
      x: center.x + circleR * Math.cos(rad),
      y: center.y + circleR * Math.sin(rad),
      originX: center.x,
      originY: center.y,
    };
  }

  // Tangent line: place new point B along the tangent at the given circle point.
  for (const { circleName, pointName, newName } of tangentLineCmds) {
    const circleCmd = circleCmds.find((c) => c.name === circleName);
    if (!circleCmd) continue;
    const center = newPtsMap[circleCmd.center];
    const pt = lookupPt(pointName);
    if (!center || !pt) continue;
    const rdx = pt.x - center.x, rdy = pt.y - center.y;
    const rlen = Math.hypot(rdx, rdy);
    if (rlen < 1e-10) continue;
    const tx = -rdy / rlen, ty = rdx / rlen;
    const bOff = circleR * 0.7;
    newPtsMap[newName] = { x: pt.x + bOff * tx, y: pt.y + bOff * ty, originX: center.x, originY: center.y };
  }

  // Compute positions for line-line intersection points (after all other points are placed).
  for (const { spec1, spec2, name } of intersectPointCmds) {
    const p1 = lookupPt(spec1[0]), p2 = lookupPt(spec1[1]);
    const p3 = lookupPt(spec2[0]), p4 = lookupPt(spec2[1]);
    if (!p1 || !p2 || !p3 || !p4) continue;
    const ex = p2.x - p1.x, ey = p2.y - p1.y;
    const fx = p4.x - p3.x, fy = p4.y - p3.y;
    const det = ey * fx - ex * fy;
    if (Math.abs(det) < 1e-10) continue; // parallel
    const gx = p3.x - p1.x, gy = p3.y - p1.y;
    const t = (gy * fx - gx * fy) / det;
    newPtsMap[name] = { x: p1.x + t * ex, y: p1.y + t * ey };
  }

  // Inscribed and circumscribed circles: compute geometry from triangle positions.
  const computedCircleGeoms = [];
  for (const { triSpec, center, northPt, touchNames } of inscribedCircleCmds) {
    const triIdx = triSpec.split("").map((c) => labels.findIndex((l) => l.label === c));
    if (triIdx.some((i) => i === -1)) continue;
    const [A, B, C] = triIdx.map((i) => positions[i]);
    const a = Math.hypot(C.x - B.x, C.y - B.y);
    const b = Math.hypot(A.x - C.x, A.y - C.y);
    const c2 = Math.hypot(B.x - A.x, B.y - A.y);
    const s = (a + b + c2) / 2;
    const area = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
    const r = area / s;
    const cx = (a * A.x + b * B.x + c2 * C.x) / (a + b + c2);
    const cy = (a * A.y + b * B.y + c2 * C.y) / (a + b + c2);
    const tcx = (A.x + B.x + C.x) / 3, tcy = (A.y + B.y + C.y) / 3;
    newPtsMap[center] = { x: cx, y: cy, pos: triLabelPos(cx, cy, tcx, tcy) };
    if (northPt) newPtsMap[northPt] = { x: cx + r, y: cy, pos: "right" };
    if (touchNames.length >= 3) {
      // touch on BC (side a): from B, distance s-b
      const tBC = (s - b) / a;
      newPtsMap[touchNames[0]] = { x: B.x + tBC * (C.x - B.x), y: B.y + tBC * (C.y - B.y), originX: cx, originY: cy };
      // touch on CA (side b): from C, distance s-c2
      const tCA = (s - c2) / b;
      newPtsMap[touchNames[1]] = { x: C.x + tCA * (A.x - C.x), y: C.y + tCA * (A.y - C.y), originX: cx, originY: cy };
      // touch on AB (side c): from A, distance s-a
      const tAB = (s - a) / c2;
      newPtsMap[touchNames[2]] = { x: A.x + tAB * (B.x - A.x), y: A.y + tAB * (B.y - A.y), originX: cx, originY: cy };
    }
    computedCircleGeoms.push({ cx, cy, r });
  }
  for (const { triSpec, center, northPt } of circumscribedCircleCmds) {
    const triIdx = triSpec.split("").map((c) => labels.findIndex((l) => l.label === c));
    if (triIdx.some((i) => i === -1)) continue;
    const [A, B, C] = triIdx.map((i) => positions[i]);
    const ax = B.x - A.x, ay = B.y - A.y;
    const bx = C.x - A.x, by = C.y - A.y;
    const D = 2 * (ax * by - ay * bx);
    if (Math.abs(D) < 1e-10) continue;
    const ux = (by * (ax * ax + ay * ay) - ay * (bx * bx + by * by)) / D;
    const uy = (ax * (bx * bx + by * by) - bx * (ax * ax + ay * ay)) / D;
    const cx = A.x + ux, cy = A.y + uy;
    const r = Math.hypot(A.x - cx, A.y - cy);
    const tcx = (A.x + B.x + C.x) / 3, tcy = (A.y + B.y + C.y) / 3;
    newPtsMap[center] = { x: cx, y: cy, pos: triLabelPos(cx, cy, tcx, tcy) };
    if (northPt) newPtsMap[northPt] = { x: cx + r, y: cy, pos: "right" };
    computedCircleGeoms.push({ cx, cy, r });
  }

  // Bounding box of all content, used to clip full-line draw commands.
  const bbMargin = { small: 0.5, medium: 0.8, large: 1.2 }[size];
  const bbPts = [
    ...(hasTriangle || hasQuad ? positions : []),
    ...Object.values(newPtsMap),
  ];
  for (const { center: cName } of circleCmds) {
    const cp = newPtsMap[cName];
    if (cp) {
      bbPts.push({ x: cp.x - circleR, y: cp.y });
      bbPts.push({ x: cp.x + circleR, y: cp.y });
      bbPts.push({ x: cp.x, y: cp.y - circleR });
      bbPts.push({ x: cp.x, y: cp.y + circleR });
    }
  }
  for (const { cx, cy, r } of computedCircleGeoms) {
    bbPts.push({ x: cx - r, y: cy });
    bbPts.push({ x: cx + r, y: cy });
    bbPts.push({ x: cx, y: cy - r });
    bbPts.push({ x: cx, y: cy + r });
  }
  let bbMinX = Infinity,
    bbMaxX = -Infinity,
    bbMinY = Infinity,
    bbMaxY = -Infinity;
  for (const { x, y } of bbPts) {
    if (x < bbMinX) bbMinX = x;
    if (x > bbMaxX) bbMaxX = x;
    if (y < bbMinY) bbMinY = y;
    if (y > bbMaxY) bbMaxY = y;
  }
  const bbX0 = bbMinX - bbMargin,
    bbX1 = bbMaxX + bbMargin;
  const bbY0 = bbMinY - bbMargin,
    bbY1 = bbMaxY + bbMargin;

  const lines = [];
  if (hasTriangle) {
    const [p0, p1, p2] = positions;
    lines.push(
      `\\draw[line width=1.5pt] (${f(p0.x)},${f(p0.y)}) -- (${f(p1.x)},${f(p1.y)}) -- (${f(p2.x)},${f(p2.y)}) -- cycle;`,
    );
  } else if (hasQuad) {
    const [p0, p1, p2, p3] = positions;
    lines.push(
      `\\draw[line width=1.5pt] (${f(p0.x)},${f(p0.y)}) -- (${f(p1.x)},${f(p1.y)}) -- (${f(p2.x)},${f(p2.y)}) -- (${f(p3.x)},${f(p3.y)}) -- cycle;`,
    );
  }

  // A segment suppresses any line/ray/tangent whose infinite line it lies on (geometric check).
  const segmentEndpoints = drawCmds
    .filter((d) => d.drawType === "segment")
    .map((d) => ({ sp1: lookupPt(d.pts[0]), sp2: lookupPt(d.pts[1]) }))
    .filter(({ sp1, sp2 }) => sp1 && sp2);
  const segmentCoversLine = (lp1, lp2) => {
    const dx = lp2.x - lp1.x, dy = lp2.y - lp1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-10) return false;
    return segmentEndpoints.some(({ sp1, sp2 }) =>
      Math.abs(dx * (sp1.y - lp1.y) - dy * (sp1.x - lp1.x)) / len < 1e-6 &&
      Math.abs(dx * (sp2.y - lp1.y) - dy * (sp2.x - lp1.x)) / len < 1e-6
    );
  };

  // Direct line / segment / ray draw commands.
  if (drawCmds.length > 0) {
    const extAmt = { small: 0.5, medium: 0.8, large: 1.2 }[size];
    lines.push("");
    for (const { drawType, pts } of drawCmds) {
      const idx1 = labels.findIndex((v) => v.label === pts[0]);
      const idx2 = labels.findIndex((v) => v.label === pts[1]);
      const p1 = idx1 !== -1 ? positions[idx1] : (newPtsMap[pts[0]] ?? null);
      const p2 = idx2 !== -1 ? positions[idx2] : (newPtsMap[pts[1]] ?? null);
      if (!p1 || !p2) continue;
      if (drawType !== "segment" && segmentCoversLine(p1, p2)) continue;
      const dx = p2.x - p1.x,
        dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-10) continue;
      const ux = dx / len,
        uy = dy / len;
      if (drawType === "segment") {
        lines.push(
          `\\draw[line width=1pt] (${f(p1.x)},${f(p1.y)}) -- (${f(p2.x)},${f(p2.y)});`,
        );
      } else if (drawType === "ray") {
        const ex = p2.x + extAmt * ux,
          ey = p2.y + extAmt * uy;
        lines.push(
          `\\draw[line width=1pt] (${f(p1.x)},${f(p1.y)}) -- (${f(ex)},${f(ey)});`,
        );
      } else {
        // Clip the infinite line to the padded image bounding box (slab method).
        let tMin = -Infinity,
          tMax = Infinity;
        if (Math.abs(ux) > 1e-10) {
          const ta = (bbX0 - p1.x) / ux,
            tb = (bbX1 - p1.x) / ux;
          tMin = Math.max(tMin, Math.min(ta, tb));
          tMax = Math.min(tMax, Math.max(ta, tb));
        }
        if (Math.abs(uy) > 1e-10) {
          const ta = (bbY0 - p1.y) / uy,
            tb = (bbY1 - p1.y) / uy;
          tMin = Math.max(tMin, Math.min(ta, tb));
          tMax = Math.min(tMax, Math.max(ta, tb));
        }
        if (tMin >= tMax) continue;
        lines.push(
          `\\draw[line width=1pt] (${f(p1.x + tMin * ux)},${f(p1.y + tMin * uy)}) -- (${f(p1.x + tMax * ux)},${f(p1.y + tMax * uy)});`,
        );
      }
    }
  }

  // Circles: draw the circle; register center + north point as named points.
  if (circleCmds.length > 0) {
    const circleR = { small: 1.5, medium: 2.0, large: 3.8 }[size];
    lines.push("");
    for (const { center, northPt } of circleCmds) {
      const ccx = 0,
        ccy = 0;
      newPtsMap[center] = { x: ccx, y: ccy, pos: "below" };
      if (northPt)
        newPtsMap[northPt] = { x: ccx + circleR, y: ccy, pos: "right" };
      lines.push(
        `\\draw[line width=1.5pt] (${f(ccx)},${f(ccy)}) circle (${f(circleR)});`,
      );
    }
  }
  // Inscribed / circumscribed circles.
  if (computedCircleGeoms.length > 0) {
    lines.push("");
    for (const { cx, cy, r } of computedCircleGeoms) {
      lines.push(`\\draw[line width=1.5pt] (${f(cx)},${f(cy)}) circle (${f(r)});`);
    }
  }
  // Tangent lines: drawn as full lines clipped to the padded bounding box.
  if (tangentLineCmds.length > 0) {
    lines.push("");
    for (const { circleName, pointName, newName } of tangentLineCmds) {
      const lp1 = lookupPt(pointName), lp2 = lookupPt(newName);
      if (lp1 && lp2 && segmentCoversLine(lp1, lp2)) continue;
      const circleCmd = circleCmds.find((c) => c.name === circleName);
      if (!circleCmd) continue;
      const center = newPtsMap[circleCmd.center];
      const pt = lookupPt(pointName);
      if (!center || !pt) continue;
      const rdx = pt.x - center.x, rdy = pt.y - center.y;
      const rlen = Math.hypot(rdx, rdy);
      if (rlen < 1e-10) continue;
      const tx = -rdy / rlen, ty = rdx / rlen;
      let tMin = -Infinity, tMax = Infinity;
      if (Math.abs(tx) > 1e-10) {
        const ta = (bbX0 - pt.x) / tx, tb = (bbX1 - pt.x) / tx;
        tMin = Math.max(tMin, Math.min(ta, tb));
        tMax = Math.min(tMax, Math.max(ta, tb));
      }
      if (Math.abs(ty) > 1e-10) {
        const ta = (bbY0 - pt.y) / ty, tb = (bbY1 - pt.y) / ty;
        tMin = Math.max(tMin, Math.min(ta, tb));
        tMax = Math.min(tMax, Math.max(ta, tb));
      }
      if (tMin >= tMax) continue;
      lines.push(
        `\\draw[line width=1pt] (${f(pt.x + tMin * tx)},${f(pt.y + tMin * ty)}) -- (${f(pt.x + tMax * tx)},${f(pt.y + tMax * ty)});`
      );
    }
  }

  lines.push("");

  for (const { spec, text, labelPos } of vertexLabelCmds) {
    const idx = labels.findIndex((v) => v.label === spec);
    if (idx !== -1) {
      const { x, y, pos } = positions[idx];
      lines.push(
        `\\node[${labelPos ?? pos}, scale=1.5] at (${f(x)},${f(y)}) {$${text ?? spec}$};`,
      );
    } else if (newPtsMap[spec]) {
      const pt = newPtsMap[spec];
      if (labelPos) {
        lines.push(
          `\\node[${labelPos}, scale=1.5] at (${f(pt.x)},${f(pt.y)}) {$${text ?? spec}$};`,
        );
        continue;
      }
      if (pt.pos) {
        lines.push(
          `\\node[${pt.pos}, scale=1.5] at (${f(pt.x)},${f(pt.y)}) {$${text ?? spec}$};`,
        );
        continue;
      }
      let lx, ly;
      const ptCmd = pointCmdByName[spec];
      if (ptCmd) {
        const i1 = labels.findIndex((v) => v.label === ptCmd.sideSpec[0]);
        const i2 = labels.findIndex((v) => v.label === ptCmd.sideSpec[1]);
        const i3 = [0, 1, 2].find((i) => i !== i1 && i !== i2);
        const sdx = positions[i2].x - positions[i1].x;
        const sdy = positions[i2].y - positions[i1].y;
        const slen = Math.hypot(sdx, sdy);
        const px = -sdy / slen,
          py = sdx / slen;
        const sign =
          px * (pt.x - positions[i3].x) + py * (pt.y - positions[i3].y) >= 0
            ? 1
            : -1;
        lx = pt.x + ptCmdLblOff * sign * px;
        ly = pt.y + ptCmdLblOff * sign * py;
      } else {
        const ox = pt.originX ?? centX;
        const oy = pt.originY ?? centY;
        const dx = pt.x - ox,
          dy = pt.y - oy;
        const len = Math.hypot(dx, dy);
        lx = pt.x + (len > 0 ? (ptLblOff * dx) / len : 0);
        ly = pt.y + (len > 0 ? (ptLblOff * dy) / len : ptLblOff);
      }
      lines.push(
        `\\node[scale=1.5] at (${f(lx)},${f(ly)}) {$${text ?? spec}$};`,
      );
    }
  }

  // Angle labels: placed at vertex, offset along the angle bisector.
  // The offset grows for small angles (≤60°) and pushes past any arc mark.
  const normalAngleOffset = { small: 0.46, medium: 0.55, large: 0.85 }[size];
  const arcPadding = { small: 0.07, medium: 0.11, large: 0.17 }[size];
  const angleLblTextOff = { small: 0.03, medium: 0.04, large: 0.06 }[size];
  let angleDefaultCounter = 0;
  for (const { spec, bigger, text } of angleLabelCmds) {
    const resolved = resolveAngleCoords(spec);
    if (!resolved) continue;
    const { vx, vy, a1x, a1y, a2x, a2y } = resolved;
    const d1 = Math.hypot(a1x - vx, a1y - vy);
    const d2 = Math.hypot(a2x - vx, a2y - vy);
    const u1x = (a1x - vx) / d1,
      u1y = (a1y - vy) / d1;
    const u2x = (a2x - vx) / d2,
      u2y = (a2y - vy) / d2;
    let bisX = u1x + u2x,
      bisY = u1y + u2y;
    const bisLen = Math.hypot(bisX, bisY);
    if (bisLen === 0) continue;
    bisX /= bisLen;
    bisY /= bisLen;
    if (bigger) {
      bisX = -bisX;
      bisY = -bisY;
    }

    // sin(θ/2) drives the offset: at θ=60° it equals normalOffset; smaller → further.
    const sinHalf = Math.max(
      Math.sin(Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y))) / 2),
      0.05,
    );
    let offset = normalAngleOffset * Math.max(1, 0.5 / sinHalf);

    // If there is an arc mark at this vertex, push the label past the outermost arc.
    const vertLabel = spec.startsWith("angle ") ? spec.slice(6) : spec[1];
    const matchMark = resolvedMarks.find(
      (m) =>
        m.type === "angle" &&
        !m.isRight &&
        (m.spec.startsWith("angle ") ? m.spec.slice(6) : m.spec[1]) ===
          vertLabel,
    );
    if (matchMark) {
      const SIN_45_HALF = Math.sin((22.5 * Math.PI) / 180);
      const adaptedArcBase = arcBase * Math.max(1, SIN_45_HALF / sinHalf);
      const na = matchMark.arcs;
      const outerR =
        na === 1
          ? adaptedArcBase * 1.3
          : na <= 3
            ? adaptedArcBase * 0.9 + (na - 1) * arcGap * 0.7
            : adaptedArcBase * 1.1 + (na - 1) * arcGap;
      offset = Math.max(offset, outerR + arcPadding);
    }

    const displayText = text ?? String(++angleDefaultCounter);
    const textLen = displayText.length;
    const finalOffset = offset + (textLen - 1) * angleLblTextOff;
    const fontScale = Math.max(1.2, 1.5 - (textLen - 1) * 0.07);
    const lx = vx + finalOffset * bisX;
    const ly = vy + finalOffset * bisY;
    lines.push(
      `\\node[scale=${f(fontScale)}] at (${f(lx)},${f(ly)}) {$${displayText}$};`,
    );
  }

  // Side labels: placed at midpoint offset outward from centroid.
  if (sideLabelCmds.length > 0) {
    const offsetBySize = { small: 0.28, medium: 0.35, large: 0.54 };
    const offset = offsetBySize[size];
    lines.push("");
    for (const { sideSpec, labelText, labelSide } of sideLabelCmds) {
      let p1, p2, defaultLabel, refPt;
      if (sideSpec.length === 1 && /^[a-z]$/.test(sideSpec)) {
        const idxPair = resolveSide(sideSpec, labels);
        if (!idxPair) continue;
        const [i1, i2] = idxPair;
        const i3 = [0, 1, 2].find((i) => i !== i1 && i !== i2);
        p1 = positions[i1];
        p2 = positions[i2];
        defaultLabel = sideSpec;
        refPt = positions[i3];
      } else if (sideSpec.length === 2) {
        p1 = lookupPt(sideSpec[0]);
        p2 = lookupPt(sideSpec[1]);
        if (!p1 || !p2) continue;
        const i1 = labels.findIndex((v) => v.label === sideSpec[0]);
        const i2 = labels.findIndex((v) => v.label === sideSpec[1]);
        if (i1 !== -1 && i2 !== -1) {
          const i3 = [0, 1, 2].find((i) => i !== i1 && i !== i2);
          defaultLabel = labels[i3].label.toLowerCase();
          refPt = positions[i3];
        }
      } else {
        continue;
      }
      const text = labelText ?? defaultLabel;
      if (!text) continue;
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      // Perpendicular to the side; offset away from refPt if available, else always left.
      const sdx = p2.x - p1.x;
      const sdy = p2.y - p1.y;
      const slen = Math.hypot(sdx, sdy);
      const px = -sdy / slen,
        py = sdx / slen;
      const sign = labelSide
        ? labelSide === "right"
          ? -1
          : 1
        : refPt
          ? px * (mx - refPt.x) + py * (my - refPt.y) >= 0
            ? 1
            : -1
          : 1;
      const lx = mx + offset * sign * px;
      const ly = my + offset * sign * py;
      let rotateDeg = 0;
      if (text.length > 3) {
        rotateDeg = (Math.atan2(sdy, sdx) * 180) / Math.PI;
        if (rotateDeg > 90) rotateDeg -= 180;
        else if (rotateDeg < -90) rotateDeg += 180;
      }
      const rotateAttr = rotateDeg !== 0 ? `, rotate=${f(rotateDeg)}` : "";
      lines.push(
        `\\node[scale=1.5${rotateAttr}] at (${f(lx)},${f(ly)}) {$${text}$};`,
      );
    }
  }

  // Mark commands.
  if (resolvedMarks.length > 0) {
    const dotR = { small: 0.055, medium: 0.09, large: 0.138 }[size];
    const tickHalf = { small: 0.092, medium: 0.15, large: 0.231 }[size];
    const tickGap = { small: 0.074, medium: 0.12, large: 0.185 }[size];
    // arcBase / arcGap defined above.
    lines.push("");
    for (const cmd of resolvedMarks) {
      if (cmd.type === "vertex") {
        const idx = labels.findIndex((v) => v.label === cmd.spec);
        const ptCoord =
          idx !== -1 ? positions[idx] : (newPtsMap[cmd.spec] ?? null);
        if (!ptCoord) continue;
        const { x, y } = ptCoord;
        lines.push(`\\fill (${f(x)},${f(y)}) circle (${dotR});`);
      } else if (cmd.type === "side") {
        let p1, p2;
        if (cmd.spec.length === 1 && /^[a-z]$/.test(cmd.spec)) {
          const idxPair = resolveSide(cmd.spec, labels);
          if (!idxPair) continue;
          p1 = positions[idxPair[0]];
          p2 = positions[idxPair[1]];
        } else if (cmd.spec.length === 2) {
          p1 = lookupPt(cmd.spec[0]);
          p2 = lookupPt(cmd.spec[1]);
        } else {
          continue;
        }
        if (!p1 || !p2) continue;
        const n = cmd.ticks;
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const sdx = p2.x - p1.x;
        const sdy = p2.y - p1.y;
        const slen = Math.hypot(sdx, sdy);
        const tx = sdx / slen,
          ty = sdy / slen; // along segment
        const px = -ty,
          py = tx; // perpendicular
        for (let t = 0; t < n; t++) {
          const off = (t - (n - 1) / 2) * tickGap;
          const tcx = mx + off * tx,
            tcy = my + off * ty;
          lines.push(
            `\\draw[line width=1pt] (${f(tcx - tickHalf * px)},${f(tcy - tickHalf * py)}) -- (${f(tcx + tickHalf * px)},${f(tcy + tickHalf * py)});`,
          );
        }
      } else if (cmd.type === "angle") {
        const resolved = resolveAngleCoords(cmd.spec);
        if (!resolved) continue;
        const { vx, vy, a1x, a1y, a2x, a2y } = resolved;
        if (cmd.isRight) {
          lines.push(rightAngleMark(vx, vy, a1x, a1y, a2x, a2y));
        } else {
          const n = cmd.arcs;
          const d1m = Math.hypot(a1x - vx, a1y - vy),
            d2m = Math.hypot(a2x - vx, a2y - vy);
          const dot45 =
            ((a1x - vx) / d1m) * ((a2x - vx) / d2m) +
            ((a1y - vy) / d1m) * ((a2y - vy) / d2m);
          const sinHalfM = Math.max(
            Math.sin(Math.acos(Math.max(-1, Math.min(1, dot45))) / 2),
            0.05,
          );
          // For θ < 45°: push arcs further from the vertex.
          const SIN_45_HALF = Math.sin((22.5 * Math.PI) / 180); // ≈ 0.383
          const adaptedArcBase = arcBase * Math.max(1, SIN_45_HALF / sinHalfM);
          let sa = (Math.atan2(a1y - vy, a1x - vx) * 180) / Math.PI;
          let ea = (Math.atan2(a2y - vy, a2x - vx) * 180) / Math.PI;
          const cross = (a1x - vx) * (a2y - vy) - (a1y - vy) * (a2x - vx);
          if (cross < 0) {
            const tmp = sa;
            sa = ea;
            ea = tmp;
          }
          while (ea <= sa) ea += 360;
          for (let arc = 0; arc < n; arc++) {
            const r =
              n === 1
                ? adaptedArcBase * 1.3
                : n <= 3
                  ? adaptedArcBase * 0.9 + arc * arcGap * 0.7
                  : adaptedArcBase * 1.1 + arc * arcGap;
            const saRad = (sa * Math.PI) / 180;
            lines.push(
              `\\draw[line width=1pt] (${f(vx + r * Math.cos(saRad))},${f(vy + r * Math.sin(saRad))}) arc (${f(sa)}:${f(ea)}:${f(r)});`,
            );
          }
        }
      }
    }
  }

  // Line constructions: bisectors, medians, altitudes, midsegments.
  if (lineCmds.length > 0) {
    lines.push("");
    for (const { p1, p2 } of lineGeoms) {
      if (p1 && p2) {
        lines.push(
          `\\draw[line width=1pt] (${f(p1.x)},${f(p1.y)}) -- (${f(p2.x)},${f(p2.y)});`,
        );
      }
    }
  }

  return `\\begin{document}\n\n\\begin{tikzpicture}\n\n${lines.join("\n")}\n\n\\end{tikzpicture}\n\n\\end{document}`;
}

function makeCompile(size) {
  return (content) => compile(content, size);
}

export default [
  { prefix: "geometry:", syntaxCheck, compile: makeCompile("medium") }, // default
  { prefix: "geometry[small]:", syntaxCheck, compile: makeCompile("small") },
  { prefix: "geometry[medium]:", syntaxCheck, compile: makeCompile("medium") },
  { prefix: "geometry[large]:", syntaxCheck, compile: makeCompile("large") },
];
