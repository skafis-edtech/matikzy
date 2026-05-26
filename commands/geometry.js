const ANGLE_TYPES = new Set(["acute", "right", "obtuse"]);
const SIDE_TYPES = new Set(["equilateral", "isosceles", "scalene"]);
const VALID_TRI_MODES = new Set(["SSS", "SAS", "ASA", "AAS"]);

// Parse "ABC", "[A]BC", "A(B)C", "[A](B)C", "DEF" etc. into 3 vertex descriptors.
// Splits a concatenated string of point names (each A or A1) into an array.
function splitPointNames(str) {
  const names = [];
  let i = 0;
  while (i < str.length) {
    if (/[A-Z]/.test(str[i])) {
      if (i + 1 < str.length && /\d/.test(str[i + 1])) {
        names.push(str[i] + str[i + 1]);
        i += 2;
      } else {
        names.push(str[i]);
        i++;
      }
    } else {
      i++;
    }
  }
  return names;
}

// mod: "none" | "mark" ([] = special angle)
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
    } else if (/[A-Z]/.test(str[i])) {
      if (i + 1 < str.length && /\d/.test(str[i + 1])) {
        verts.push({ label: str[i] + str[i + 1], mod: "none" });
        i += 2;
      } else {
        verts.push({ label: str[i], mod: "none" });
        i++;
      }
    } else {
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
    } else if (/[A-Z]/.test(str[i])) {
      if (i + 1 < str.length && /\d/.test(str[i + 1])) {
        verts.push({ label: str[i] + str[i + 1], mod: "none" });
        i += 2;
      } else {
        verts.push({ label: str[i], mod: "none" });
        i++;
      }
    } else {
      i++;
    }
  }
  return verts.length === 4 ? verts : null;
}

function parseTriangle(content) {
  const words = content.trim().split(/\s+/);
  if (words[0] !== "triangle")
    return {
      angle: null,
      side: null,
      unknown: words,
      labelStr: null,
      triMode: null,
      triValues: null,
      triTransforms: [],
    };

  // New numeric format: triangle SSS/SAS/ASA/AAS v1 v2 v3 new <label> [>>transforms...]
  if (words.length >= 2 && VALID_TRI_MODES.has(words[1])) {
    const mode = words[1];
    const unknown = [];

    let transformStart = words.length;
    for (let i = 2; i < words.length; i++) {
      if (words[i].startsWith(">>")) {
        transformStart = i;
        break;
      }
    }

    const mainWords = words.slice(2, transformStart);
    const transformWords = words.slice(transformStart);

    const isNumeric = (w) => /^-?\d*\.?\d+$/.test(w);
    const numericWords = mainWords.filter(isNumeric);

    let triValues = null;
    if (numericWords.length >= 3)
      triValues = numericWords.slice(0, 3).map(Number);
    if (numericWords.length > 3) unknown.push(...numericWords.slice(3));

    const newIdx = mainWords.indexOf("new");
    let labelStr = null;
    if (newIdx === -1) {
      unknown.push("__missing_new__");
    } else if (!mainWords[newIdx + 1]) {
      labelStr = "ABC";
    } else if (!parseLabels(mainWords[newIdx + 1])) {
      unknown.push("__missing_label__");
    } else {
      labelStr = mainWords[newIdx + 1];
    }

    for (let idx = 0; idx < mainWords.length; idx++) {
      const w = mainWords[idx];
      if (newIdx !== -1 && (idx === newIdx || idx === newIdx + 1)) continue;
      if (!isNumeric(w)) unknown.push(w);
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

    return {
      angle: null,
      side: null,
      unknown,
      labelStr,
      triMode: mode,
      triValues,
      triTransforms,
    };
  }

  // Original keyword format: triangle [angle] [side] [>>transforms...] new <label>
  let angle = null,
    side = null,
    labelStr = null;
  const unknown = [];

  let transformStart = words.length;
  for (let i = 1; i < words.length; i++) {
    if (words[i].startsWith(">>")) {
      transformStart = i;
      break;
    }
  }
  const mainWords = words.slice(1, transformStart);
  const transformWords = words.slice(transformStart);

  const newIdx = mainWords.indexOf("new");
  if (newIdx === -1) {
    unknown.push("__missing_new__");
  } else if (!mainWords[newIdx + 1]) {
    labelStr = "ABC";
  } else if (!parseLabels(mainWords[newIdx + 1])) {
    unknown.push("__missing_label__");
  } else {
    labelStr = mainWords[newIdx + 1];
  }

  for (let idx = 0; idx < mainWords.length; idx++) {
    const word = mainWords[idx];
    if (newIdx !== -1 && (idx === newIdx || idx === newIdx + 1)) continue;
    if (ANGLE_TYPES.has(word)) {
      angle === null ? (angle = word) : unknown.push(word);
    } else if (SIDE_TYPES.has(word)) {
      side === null ? (side = word) : unknown.push(word);
    } else {
      unknown.push(word);
    }
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

  return {
    angle,
    side,
    unknown,
    labelStr,
    triMode: null,
    triValues: null,
    triTransforms,
  };
}

const QUAD_SINGLE_TYPES = new Set([
  "square",
  "rectangle",
  "parallelogram",
  "rhombus",
  "trapezoid",
]);
const VALID_QUAD_MODES = new Set(["SSSSD", "SSSDD", "SSAAA", "SSSAA"]);

function parseQuadTransforms(words, unknown) {
  const quadTransforms = [];
  for (const tw of words) {
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
  return quadTransforms;
}

function parseQuadrilateral(content) {
  const words = content.trim().split(/\s+/);
  if (words[0] !== "quadrilateral") return null;

  // Free-form numeric mode: quadrilateral SSSSD/SSSDD/SSAAA/SSSAA v1..v5 [label] [>>transforms]
  if (words.length >= 2 && VALID_QUAD_MODES.has(words[1])) {
    const quadMode = words[1];
    const unknown = [];

    let transformStart = words.length;
    for (let i = 2; i < words.length; i++) {
      if (words[i].startsWith(">>")) {
        transformStart = i;
        break;
      }
    }
    const mainWords = words.slice(2, transformStart);
    const transformWords = words.slice(transformStart);

    const isNumeric = (w) => /^-?\d*\.?\d+$/.test(w);
    const numericWords = mainWords.filter(isNumeric);

    let quadValues = null;
    if (numericWords.length >= 5)
      quadValues = numericWords.slice(0, 5).map(Number);
    if (numericWords.length > 5) unknown.push(...numericWords.slice(5));

    const newIdx = mainWords.indexOf("new");
    let labelStr = null;
    if (newIdx === -1) {
      unknown.push("__missing_new__");
    } else if (!mainWords[newIdx + 1]) {
      labelStr = "ABCD";
    } else if (!parseQuadLabels(mainWords[newIdx + 1])) {
      unknown.push("__missing_label__");
    } else {
      labelStr = mainWords[newIdx + 1];
    }

    for (let idx = 0; idx < mainWords.length; idx++) {
      const w = mainWords[idx];
      if (newIdx !== -1 && (idx === newIdx || idx === newIdx + 1)) continue;
      if (!isNumeric(w)) unknown.push(w);
    }

    const quadTransforms = parseQuadTransforms(transformWords, unknown);
    return {
      quadType: null,
      quadMode,
      quadValues,
      labelStr,
      quadTransforms,
      unknown,
    };
  }

  // Named type mode: quadrilateral square/rectangle/… [ABCD] [>>transforms]
  let transformStart = words.length;
  for (let i = 1; i < words.length; i++) {
    if (words[i].startsWith(">>")) {
      transformStart = i;
      break;
    }
  }
  const mainWords = words.slice(1, transformStart);
  const transformWords = words.slice(transformStart);

  let quadType = null;
  let labelStr = null;
  const unknown = [];

  const newIdx = mainWords.indexOf("new");
  if (newIdx === -1) {
    unknown.push("__missing_new__");
  } else if (!mainWords[newIdx + 1]) {
    labelStr = "ABCD";
  } else if (!parseQuadLabels(mainWords[newIdx + 1])) {
    unknown.push("__missing_label__");
  } else {
    labelStr = mainWords[newIdx + 1];
  }

  let i = 0;
  while (i < mainWords.length) {
    if (newIdx !== -1 && (i === newIdx || i === newIdx + 1)) {
      i++;
      continue;
    }
    const w = mainWords[i];
    const wNext = mainWords[i + 1];
    const twoWord =
      (w === "right" || w === "isosceles") && wNext === "trapezoid"
        ? w + " " + wNext
        : null;
    if (twoWord) {
      quadType === null
        ? ((quadType = twoWord), (i += 2))
        : (unknown.push(w), i++);
    } else if (QUAD_SINGLE_TYPES.has(w)) {
      quadType === null ? ((quadType = w), i++) : (unknown.push(w), i++);
    } else {
      unknown.push(w);
      i++;
    }
  }

  const quadTransforms = parseQuadTransforms(transformWords, unknown);
  return {
    quadType,
    quadMode: null,
    quadValues: null,
    labelStr,
    quadTransforms,
    unknown,
  };
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
function resolveSide(spec, labels) {
  const names = splitPointNames(spec);
  if (names.length === 2) {
    const i1 = labels.findIndex((v) => v.label === names[0]);
    const i2 = labels.findIndex((v) => v.label === names[1]);
    return i1 !== -1 && i2 !== -1 && i1 !== i2 ? [i1, i2] : null;
  }
  return null;
}

// allPointNames (optional Set) broadens matching beyond triangle vertices.
function isAngleSpec(spec, vertexNames, allPointNames) {
  if (spec.startsWith("angle ")) {
    const name = spec.slice(6);
    return vertexNames.includes(name) || !!allPointNames?.has(name);
  }
  const pts = allPointNames ?? new Set(vertexNames);
  const names = splitPointNames(spec);
  return names.length === 3 && names.every((n) => pts.has(n));
}

function dirToAnchor(dx, dy) {
  const ax = Math.abs(dx),
    ay = Math.abs(dy);
  const v = ay > ax * 0.4 ? (dy > 0 ? "south" : "north") : "";
  const h = ax > ay * 0.4 ? (dx > 0 ? "west" : "east") : "";
  return v + (v && h ? " " : "") + h || "center";
}

function normPos(p) {
  return p.replace("top", "above").replace("bottom", "below");
}

// "A1" → "A_1", "B2" → "B_2", "A" → "A"
function defaultLabelText(name) {
  return /^[A-Z]\d$/.test(name) ? `${name[0]}_${name[1]}` : name;
}

function isValidSideSpec(spec, vertexLabels) {
  const names = splitPointNames(spec);
  return (
    names.length === 2 &&
    vertexLabels.includes(names[0]) &&
    vertexLabels.includes(names[1]) &&
    names[0] !== names[1]
  );
}

// --- Numeric triangle construction helpers ---

function computeRawTriVerts(mode, values) {
  // A=(0,0) bottom-left, B=apex top, C=(sCA,0) bottom-right — clockwise A→B→C.
  const deg2rad = (d) => (d * Math.PI) / 180;
  if (mode === "SSS") {
    // values: sCA, sAB, sBC
    const [sCA, sAB, sBC] = values;
    const cosA = Math.max(
      -1,
      Math.min(1, (sAB * sAB + sCA * sCA - sBC * sBC) / (2 * sAB * sCA)),
    );
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    return [
      { x: 0, y: 0 },
      { x: sAB * cosA, y: sAB * sinA },
      { x: sCA, y: 0 },
    ];
  }
  if (mode === "SAS") {
    // values: sCA, angleA, sAB  — angle at A between CA and AB
    const [sCA, angleA, sAB] = values;
    const rA = deg2rad(angleA);
    return [
      { x: 0, y: 0 },
      { x: sAB * Math.cos(rA), y: sAB * Math.sin(rA) },
      { x: sCA, y: 0 },
    ];
  }
  if (mode === "ASA") {
    // values: angleC, sCA, angleA
    const [angleC, sCA, angleA] = values;
    const angleB = 180 - angleA - angleC;
    const rA = deg2rad(angleA),
      rB = deg2rad(angleB),
      rC = deg2rad(angleC);
    const sAB = Math.sin(rB) > 1e-10 ? (sCA * Math.sin(rC)) / Math.sin(rB) : 0;
    return [
      { x: 0, y: 0 },
      { x: sAB * Math.cos(rA), y: sAB * Math.sin(rA) },
      { x: sCA, y: 0 },
    ];
  }
  if (mode === "AAS") {
    // values: angleC, angleA, sAB
    const [angleC, angleA, sAB] = values;
    const angleB = 180 - angleA - angleC;
    const rA = deg2rad(angleA),
      rB = deg2rad(angleB),
      rC = deg2rad(angleC);
    const sCA = Math.sin(rC) > 1e-10 ? (sAB * Math.sin(rB)) / Math.sin(rC) : 0;
    return [
      { x: 0, y: 0 },
      { x: sAB * Math.cos(rA), y: sAB * Math.sin(rA) },
      { x: sCA, y: 0 },
    ];
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
  return pts.map((p) => ({ x: p.x * scale, y: p.y * scale }));
}

// Rotate all points clockwise by angleDeg.
function rotVertsBy(pts, angleDeg) {
  const rad = (-angleDeg * Math.PI) / 180;
  return pts.map((p) => ({
    x: p.x * Math.cos(rad) - p.y * Math.sin(rad),
    y: p.x * Math.sin(rad) + p.y * Math.cos(rad),
  }));
}

// Translate/rotate so pts[i1] is at origin and pts[i2] is on positive x-axis.
// Flips vertically if the third vertex ends up below the x-axis.
function sideToHorizontal(pts, i1, i2) {
  const ox = pts[i1].x,
    oy = pts[i1].y;
  let tpts = pts.map((p) => ({ x: p.x - ox, y: p.y - oy }));
  const angleDeg = (Math.atan2(tpts[i2].y, tpts[i2].x) * 180) / Math.PI;
  tpts = rotVertsBy(tpts, angleDeg);
  const i3 = [0, 1, 2].find((i) => i !== i1 && i !== i2);
  if (tpts[i3].y < 0) tpts = tpts.map((p) => ({ x: p.x, y: -p.y }));
  return tpts;
}

function applyTriTransforms(pts, transforms) {
  let cur = pts.map((p) => ({ ...p }));
  // Cycle: AC base (default) → CB base → BA base → AC base
  const sideVerts = [
    [0, 2],
    [2, 1],
    [1, 0],
  ];
  let baseIdx = 0;

  for (const t of transforms) {
    if (t.type === "invert") {
      cur = cur.map((p) => ({ x: -p.x, y: p.y }));
    } else if (t.type === "rot" && t.degrees === null) {
      baseIdx = (baseIdx + 1) % 3;
      const [i1, i2] = sideVerts[baseIdx];
      cur = sideToHorizontal(cur, i1, i2);
    } else if (t.type === "rot") {
      cur = rotVertsBy(cur, t.degrees);
    }
  }

  const minY = Math.min(...cur.map((p) => p.y));
  const minX = Math.min(...cur.map((p) => p.x));
  return cur.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}

// Medium-size vertices [A,B,C,D] for each quad type. Scaled ×0.75 for small, ×1.375 for large.
// Clockwise from bottom-left: A=bottom-left, B=top-left, C=top-right, D=bottom-right.
const QUAD_VERTS = {
  square: [
    [0, 0],
    [0, 4],
    [4, 4],
    [4, 0],
  ],
  rectangle: [
    [0, 0],
    [0, 3],
    [5.5, 3],
    [5.5, 0],
  ],
  parallelogram: [
    [0, 0],
    [1.5, 2.598],
    [6.5, 2.598],
    [5, 0],
  ],
  rhombus: [
    [0, 0],
    [2, 3.464],
    [6, 3.464],
    [4, 0],
  ],
  trapezoid: [
    [0, 0],
    [2, 3.464],
    [6, 3.464],
    [12, 0],
  ],
  "right trapezoid": [
    [0, 0],
    [0, 3.5],
    [3.938, 3.5],
    [10, 0],
  ],
  "isosceles trapezoid": [
    [0, 0],
    [2, 3.464],
    [6, 3.464],
    [8, 0],
  ],
};
const QUAD_SCALE = { small: 0.75, medium: 1.0, large: 1.375 };

function applyQuadTransforms(pts, transforms) {
  let cur = pts.map((p) => ({ ...p }));
  const sideVerts = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ];
  let baseIdx = 0;

  for (const t of transforms) {
    if (t.type === "invert") {
      cur = cur.map((p) => ({ x: -p.x, y: p.y }));
    } else if (t.type === "rot" && t.degrees === null) {
      baseIdx = (baseIdx + 1) % 4;
      const [i1, i2] = sideVerts[baseIdx];
      cur = sideToHorizontal(cur, i1, i2);
    } else if (t.type === "rot") {
      cur = rotVertsBy(cur, t.degrees);
    }
  }

  const minY = Math.min(...cur.map((p) => p.y));
  const minX = Math.min(...cur.map((p) => p.x));
  return cur.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}

function quadLabelPos(x, y, cx, cy) {
  const dy = y - cy,
    dx = x - cx;
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
  return transformed.map((p) => ({
    x: p.x,
    y: p.y,
    pos: quadLabelPos(p.x, p.y, cx, cy),
  }));
}

const QUAD_FREEFORM_TARGET = { small: 3.1, medium: 5.0, large: 7.7 };

function computeRawQuadVerts(mode, values) {
  const deg2rad = (d) => (d * Math.PI) / 180;
  const clamp = (v) => Math.max(-1, Math.min(1, v));

  if (mode === "SSSSD") {
    // AB, BC, CD, DA, diag_AC
    const [sAB, sBC, sCD, sDA, sAC] = values;
    const A = { x: 0, y: 0 },
      B = { x: sAB, y: 0 };
    const cosBAC = clamp((sAB * sAB + sAC * sAC - sBC * sBC) / (2 * sAB * sAC));
    const angBAC = Math.acos(cosBAC);
    const C = { x: sAC * Math.cos(angBAC), y: sAC * Math.sin(angBAC) };
    // D from triangle ACD on opposite side of AC from B
    const cosCAD = clamp((sAC * sAC + sDA * sDA - sCD * sCD) / (2 * sAC * sDA));
    const angCAD = Math.acos(cosCAD);
    const dirAD = angBAC + angCAD;
    const D = { x: sDA * Math.cos(dirAD), y: sDA * Math.sin(dirAD) };
    return [A, B, C, D];
  }

  if (mode === "SSSDD") {
    // AB, BC, CD, diag_AC, diag_BD
    const [sAB, sBC, sCD, sAC, sBD] = values;
    const A = { x: 0, y: 0 },
      B = { x: sAB, y: 0 };
    const cosBAC = clamp((sAB * sAB + sAC * sAC - sBC * sBC) / (2 * sAB * sAC));
    const angBAC = Math.acos(cosBAC);
    const C = { x: sAC * Math.cos(angBAC), y: sAC * Math.sin(angBAC) };
    // D from circles: |BD|=sBD, |CD|=sCD; pick side opposite to B relative to AC
    const dirBC = Math.atan2(C.y - B.y, C.x - B.x);
    const dirCB = dirBC + Math.PI;
    const cosBCD = clamp((sBC * sBC + sCD * sCD - sBD * sBD) / (2 * sBC * sCD));
    const angBCD = Math.acos(cosBCD);
    const D1 = {
      x: C.x + sCD * Math.cos(dirCB + angBCD),
      y: C.y + sCD * Math.sin(dirCB + angBCD),
    };
    const D2 = {
      x: C.x + sCD * Math.cos(dirCB - angBCD),
      y: C.y + sCD * Math.sin(dirCB - angBCD),
    };
    // Pick D on opposite side of AC from B
    const nx = C.y,
      ny = -C.x; // normal to AC direction (perpendicular, rotated CW)
    const signB = B.x * nx + B.y * ny;
    const sign1 = D1.x * nx + D1.y * ny;
    const D = signB * sign1 < 0 ? D1 : D2;
    return [A, B, C, D];
  }

  if (mode === "SSAAA") {
    // AB, BC, angleA, angleB, angleC (interior angles; polygon above x-axis, CCW traversal)
    const [sAB, sBC, angA, angB, angC] = values;
    const rA = deg2rad(angA),
      rB = deg2rad(angB),
      rC = deg2rad(angC);
    const A = { x: 0, y: 0 },
      B = { x: sAB, y: 0 };
    const dirBC = Math.PI - rB;
    const C = {
      x: B.x + sBC * Math.cos(dirBC),
      y: B.y + sBC * Math.sin(dirBC),
    };
    const dirCD = 2 * Math.PI - rB - rC;
    const dirAD = rA;
    // D = intersection of ray from A (dirAD) and ray from C (dirCD)
    const cAD = Math.cos(dirAD),
      sAD = Math.sin(dirAD);
    const cCD = Math.cos(dirCD),
      sCD_val = Math.sin(dirCD);
    const det = cAD * -sCD_val - sAD * -cCD;
    if (Math.abs(det) < 1e-10) return null;
    const t = ((C.x - A.x) * -sCD_val - (C.y - A.y) * -cCD) / det;
    if (t <= 0) return null;
    const D = { x: A.x + t * cAD, y: A.y + t * sAD };
    return [A, B, C, D];
  }

  if (mode === "SSSAA") {
    // AB, BC, CD, angleB, angleC (included interior angles at B and C)
    const [sAB, sBC, sCD, angB, angC] = values;
    const rB = deg2rad(angB),
      rC = deg2rad(angC);
    const A = { x: 0, y: 0 },
      B = { x: sAB, y: 0 };
    const dirBC = Math.PI - rB;
    const C = {
      x: B.x + sBC * Math.cos(dirBC),
      y: B.y + sBC * Math.sin(dirBC),
    };
    const dirCD = 2 * Math.PI - rB - rC;
    const D = {
      x: C.x + sCD * Math.cos(dirCD),
      y: C.y + sCD * Math.sin(dirCD),
    };
    return [A, B, C, D];
  }

  return null;
}

function scaleQuadVerts(pts, size) {
  const sides = [
    Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
    Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y),
    Math.hypot(pts[3].x - pts[2].x, pts[3].y - pts[2].y),
    Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y),
  ];
  const maxSide = Math.max(...sides);
  if (maxSide < 1e-10) return pts;
  const scale = QUAD_FREEFORM_TARGET[size] / maxSide;
  return pts.map((p) => ({ x: p.x * scale, y: p.y * scale }));
}

function computeQuadFreeformPositions(
  quadMode,
  quadValues,
  quadTransforms,
  size,
) {
  const raw = computeRawQuadVerts(quadMode, quadValues);
  if (!raw) return null;
  const scaled = scaleQuadVerts(raw, size);
  const transformed = applyQuadTransforms(scaled, quadTransforms);
  const cx = transformed.reduce((acc, p) => acc + p.x, 0) / 4;
  const cy = transformed.reduce((acc, p) => acc + p.y, 0) / 4;
  return transformed.map((p) => ({
    x: p.x,
    y: p.y,
    pos: quadLabelPos(p.x, p.y, cx, cy),
  }));
}

function triLabelPos(x, y, cx, cy) {
  const dy = y - cy,
    dx = x - cx;
  const vert = dy > 0.1 ? "above" : "below";
  const horiz = dx < -0.2 ? " left" : dx > 0.2 ? " right" : "";
  return vert + horiz;
}

const TRI_SIZE_SCALE = { small: 0.55, medium: 1.0, large: 1.375 };

function computeTrianglePositions(triMode, triValues, triTransforms, size) {
  const raw = computeRawTriVerts(triMode, triValues);
  if (!raw) return null;
  const scale = TRI_SIZE_SCALE[size] ?? 1;
  const scaled = raw.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const transformed = applyTriTransforms(scaled, triTransforms);
  const cx = (transformed[0].x + transformed[1].x + transformed[2].x) / 3;
  const cy = (transformed[0].y + transformed[1].y + transformed[2].y) / 3;
  return transformed.map((p) => ({
    x: p.x,
    y: p.y,
    pos: triLabelPos(p.x, p.y, cx, cy),
  }));
}

// Splits content (any whitespace layout) into command chunks by keyword boundaries.
function parseContent(content) {
  const lines = content
    .trim()
    .split(
      /(?<=\s)(?=(?:triangle|quadrilateral|label|mark|line|point|circle|area|arc|cube|cuboid|pyramid)\b)/,
    )
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const hasTriangle = (lines[0] || "").split(/\s+/)[0] === "triangle";
  const hasQuad = (lines[0] || "").split(/\s+/)[0] === "quadrilateral";
  const triangleResult = hasTriangle
    ? parseTriangle(lines[0] || "")
    : {
        angle: null,
        side: null,
        unknown: [],
        labelStr: null,
        triMode: null,
        triValues: null,
        triTransforms: [],
      };
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
  const arcLabelCmds = [];
  const areaFillCmds = [];
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
  const distanceCmds = [];
  const linearPointCmds = [];
  const secondaryPolyFigureCmds = [];
  const arcDrawCmds = [];
  const cubeCmds = [];
  const cuboidCmds = [];
  const pyramidCmds = [];
  const extraErrors = [];
  if (hasQuad && quadResult.unknown.length > 0) {
    const qu = quadResult.unknown;
    if (qu.includes("__missing_new__"))
      extraErrors.push(
        `Basis shape must include "new" before the name (e.g. "quadrilateral square new ABCD")`,
      );
    if (qu.includes("__missing_label__"))
      extraErrors.push(
        `Basis shape requires a valid name after "new" (e.g. "quadrilateral square new ABCD")`,
      );
    const realQu = qu.filter((w) => !w.startsWith("__"));
    if (realQu.length > 0)
      extraErrors.push(
        `Unknown modifier(s): ${realQu.map((w) => `"${w}"`).join(", ")}`,
      );
  }

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
      } else {
        const ni = ws.indexOf("new");
        if (ni !== -1 && ws[ni + 1]) pointNewNames.add(ws[ni + 1]);
      }
    } else if (ws[0] === "circle") {
      const isSpec = ws[1] === "inscribe" || ws[1] === "circumscribe";
      const ni = isSpec ? ws.indexOf("new") : -1;
      const isCustomR = !isSpec && /^\d+(?:\.\d+)?$/.test(ws[1] ?? "");
      const nm = isSpec
        ? (ni !== -1 ? (ws[ni + 1] ?? "") : "")
        : isCustomR
          ? (ws[2] === "new" ? (ws[3] ?? "O-OX") : "")
          : (ws[1] === "new" ? (ws[2] ?? "O-OX") : (ws[1] ?? ""));
      const d = nm.indexOf("-");
      if (d > 0) {
        const ctr = nm.slice(0, d);
        const rs = nm.slice(d + 1);
        const np = rs.startsWith(ctr) ? rs.slice(ctr.length) : rs;
        circleNewNames.add(ctr);
        if (np) circleNewNames.add(np);
      }
      if (isSpec && ni !== -1)
        ws.slice(ni + 2).forEach((n) => circleNewNames.add(n));
    } else if (ws[0] === "cube") {
      const ni = ws.indexOf("new");
      if (ni !== -1)
        splitPointNames(ws[ni + 1] ?? "ABCDA1B1C1D1").forEach((n) => circleNewNames.add(n));
    } else if (ws[0] === "cuboid") {
      const ni = ws.indexOf("new");
      if (ni !== -1)
        splitPointNames(ws[ni + 1] ?? "ABCDA1B1C1D1").forEach((n) => circleNewNames.add(n));
    } else if (ws[0] === "pyramid") {
      const ni = ws.indexOf("new");
      if (ni !== -1) {
        const nw = ws[ni + 1] ?? "";
        splitPointNames((nw === "" || nw.startsWith(">>")) ? "SABC" : nw).forEach((n) => circleNewNames.add(n));
      }
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
      } else if (words[1] === "arc") {
        const circleName = words[2] ?? "";
        const arcPts = splitPointNames(words[3] ?? "");
        let i = 4;
        const bigger = words[i] === "bigger" ? (i++, true) : false;
        const text = words.slice(i).join(" ") || null;
        arcLabelCmds.push({ circleName, arcPts, bigger, text });
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
        if (
          isAngleSpec(spec, vertexNames, allPointNames) &&
          words[i] === "bigger"
        ) {
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
          const orientWord = posWords.find(
            (w) => w === "horizontal" || w === "aligned",
          );
          const sideWords = posWords.filter(
            (w) => w !== "horizontal" && w !== "aligned",
          );
          const labelSide = sideWords.length > 0 ? sideWords[0] : null;
          const labelOrient = orientWord ?? null;
          const labelText = textWords.length > 0 ? textWords.join(" ") : null;
          if (labelText === null) {
            extraErrors.push(
              `"label ${spec}": a label text is required (e.g. "label AC b")`,
            );
          } else {
            sideLabelCmds.push({
              sideSpec: spec,
              labelText,
              labelSide,
              labelOrient,
            });
          }
        }
      }
    } else if (words[0] === "area") {
      const pts = splitPointNames(words[1] ?? "");
      const rest = words.slice(2);
      const sepIdx = rest.indexOf("--");
      let label = null,
        style = "solid";
      if (sepIdx === -1) {
        label = rest.length > 0 ? rest.join(" ") : null;
      } else {
        label = sepIdx > 0 ? rest.slice(0, sepIdx).join(" ") : null;
        style = rest.slice(sepIdx + 1).join(" ") || "solid";
      }
      areaFillCmds.push({ pts, label, style });
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
          intersectPointCmds.push({
            spec1: words[1],
            spec2: words[3],
            name: words[5],
          });
        }
      } else if (
        splitPointNames(words[1] ?? "").length === 2 &&
        /^[A-Z]\d?$/.test(words[2] ?? "") &&
        !isNaN(parseFloat(words[3] ?? "")) &&
        words[3] !== undefined
      ) {
        // Linear point: point A1B2 A1 5 [right|left] new C3
        const lineSpec = splitPointNames(words[1]);
        const refPt = words[2];
        const dist = parseFloat(words[3]);
        const newIdx = words.indexOf("new");
        const dirWord = newIdx > 4 ? words[4] : null;
        const left = dirWord === "left";
        const newName = newIdx !== -1 ? (words[newIdx + 1] ?? "") : "";
        if (!newName) {
          extraErrors.push(
            `"point": linear format requires "new <name>" (e.g. "point A1B2 A1 5 right new C3")`,
          );
        } else {
          linearPointCmds.push({ lineSpec, refPt, dist, left, newName });
        }
      } else if (words.length < 5 || words[3] !== "new") {
        extraErrors.push(
          `"point" requires: side ratio new name (e.g. "point KL 1:4 new H"), circle angle new name (e.g. "point O-OX -120 new G"), side intersect side new name (e.g. "point AB intersect CD new K"), or linear point (e.g. "point AB A 5 right new C")`,
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
        const sepIdx = words.indexOf("--");
        const lineStyle = sepIdx !== -1 ? (words[sepIdx + 1] ?? null) : null;
        drawCmds.push({ drawType: words[1], pts: splitPointNames(words[2] ?? ""), lineStyle });
      } else if (words[1] === "arrow") {
        const sepIdx = words.indexOf("--");
        const lineStyle = sepIdx !== -1 ? (words[sepIdx + 1] ?? null) : null;
        drawCmds.push({ drawType: "arrow", pts: splitPointNames(words[2] ?? ""), lineStyle });
      } else if (words[1] === "distance") {
        const newIdx = words.indexOf("new");
        const fromPt = words[2] ?? "";
        const segPts = splitPointNames(words[3] ?? "");
        const newName = newIdx !== -1 ? (words[newIdx + 1] ?? "") : "";
        if (!fromPt || segPts.length !== 2 || !newName) {
          extraErrors.push(
            `"line distance": format is "line distance <point> <segment> new <name>" (e.g. "line distance C AB new K")`,
          );
        } else {
          distanceCmds.push({ fromPt, segPts, newName });
        }
      } else if (words[1] && splitPointNames(words[1]).length === 2) {
        const sepIdx = words.indexOf("--");
        const lineStyle = sepIdx !== -1 ? (words[sepIdx + 1] ?? null) : null;
        drawCmds.push({ drawType: "line", pts: splitPointNames(words[1]), lineStyle });
      } else if (words[1] === "tangent") {
        if (words.length < 6 || words[4] !== "new") {
          extraErrors.push(
            `"line tangent": format is "line tangent <circle> <point> new <name>"`,
          );
        } else {
          tangentLineCmds.push({
            circleName: words[2],
            pointName: words[3],
            newName: words[5],
          });
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
          extraErrors.push(
            `"circle ${circleType}": missing "new <circleName>"`,
          );
        } else {
          const triSpec = words[2] ?? "";
          const circleName = words[ni + 1];
          const dash = circleName.indexOf("-");
          if (dash <= 0 || dash === circleName.length - 1) {
            extraErrors.push(
              `"circle ${circleType}": invalid circle name "${circleName}" — expected "center-radiusSide"`,
            );
          } else {
            const center = circleName.slice(0, dash);
            const radiusSide = circleName.slice(dash + 1);
            const northPt = radiusSide.startsWith(center)
              ? radiusSide.slice(center.length)
              : radiusSide;
            if (circleType === "inscribe") {
              inscribedCircleCmds.push({
                triSpec,
                circleName,
                center,
                northPt,
                touchNames: words.slice(ni + 2),
              });
            } else {
              circumscribedCircleCmds.push({
                triSpec,
                circleName,
                center,
                northPt,
              });
            }
          }
        }
      } else {
        const nm = words[1] ?? "";
        const secDash = nm.indexOf("-");
        const isCustomRadius = /^\d+(?:\.\d+)?$/.test(nm);
        if (secDash > 0 && secDash < nm.length - 1) {
          // Secondary circle from existing points: circle D-DN
          const center = nm.slice(0, secDash);
          const radiusSide = nm.slice(secDash + 1);
          const northPt = radiusSide.startsWith(center)
            ? radiusSide.slice(center.length)
            : radiusSide;
          circleCmds.push({
            name: nm,
            center,
            radiusSide,
            northPt,
            fromExisting: true,
          });
        } else if (isCustomRadius) {
          // circle 5 new O-OX  (custom radius)
          const customRadius = parseFloat(nm);
          if (words[2] !== "new") {
            extraErrors.push(
              `"circle ${nm}": requires "new" before the name (e.g. "circle ${nm} new O-OX")`,
            );
          } else {
            const name = words[3] ?? "O-OX";
            const dash = name.indexOf("-");
            if (dash <= 0 || dash === name.length - 1) {
              extraErrors.push(
                `"circle ${nm} new ${name}": invalid format — expected "center-radiusSide" (e.g. "circle ${nm} new O-OX")`,
              );
            } else {
              const center = name.slice(0, dash);
              const radiusSide = name.slice(dash + 1);
              const northPt = radiusSide.startsWith(center)
                ? radiusSide.slice(center.length)
                : radiusSide;
              const hWord = words.find((w) => /^>>h\d*\.?\d+$/.test(w));
              const hScale = hWord ? parseFloat(hWord.slice(3)) : 1;
              circleCmds.push({ name, center, radiusSide, northPt, hScale, customRadius });
            }
          }
        } else if (words[1] !== "new") {
          extraErrors.push(
            `"circle": requires "new" before the name (e.g. "circle new O-OX") or use existing points (e.g. "circle D-DN")`,
          );
        } else {
          const name = words[2] ?? "O-OX";
          const dash = name.indexOf("-");
          if (dash <= 0 || dash === name.length - 1) {
            extraErrors.push(
              `"circle new ${name}": invalid format — expected "center-radiusSide" (e.g. "circle new O-OX")`,
            );
          } else {
            const center = name.slice(0, dash);
            const radiusSide = name.slice(dash + 1);
            const northPt = radiusSide.startsWith(center)
              ? radiusSide.slice(center.length)
              : radiusSide;
            const hWord = words.find((w) => /^>>h\d*\.?\d+$/.test(w));
            const hScale = hWord ? parseFloat(hWord.slice(3)) : 1;
            circleCmds.push({ name, center, radiusSide, northPt, hScale });
          }
        }
      }
    } else if (
      words[0] === "triangle" &&
      words[1] &&
      splitPointNames(words[1]).length === 3
    ) {
      secondaryPolyFigureCmds.push({
        type: "triangle",
        pts: splitPointNames(words[1]),
      });
    } else if (
      words[0] === "quadrilateral" &&
      words[1] &&
      splitPointNames(words[1]).length === 4
    ) {
      secondaryPolyFigureCmds.push({
        type: "quadrilateral",
        pts: splitPointNames(words[1]),
      });
    } else if (words[0] === "arc") {
      const circleName = words[1] ?? "";
      const arcPts = splitPointNames(words[2] ?? "");
      let i = 3;
      const bigger = words[i] === "bigger" ? (i++, true) : false;
      let style = "solid";
      if (words[i] === "--") {
        i++;
        style = words[i] ?? "solid";
      }
      arcDrawCmds.push({ circleName, arcPts, bigger, style });
    } else if (words[0] === "cube") {
      const hasSide = /^\d+(?:\.\d+)?$/.test(words[1] ?? "");
      const sideLen = hasSide ? parseFloat(words[1]) : null;
      const newIdx = hasSide ? 2 : 1;
      if (words[newIdx] !== "new") {
        extraErrors.push(
          `"cube": requires "new" before the name (e.g. "cube new ABCDA1B1C1D1" or "cube 4 new ABCDA1B1C1D1")`,
        );
      } else {
        const pts = splitPointNames(words[newIdx + 1] ?? "ABCDA1B1C1D1");
        if (pts.length !== 8) {
          extraErrors.push(
            `"cube": requires exactly 8 point names (e.g. "cube new ABCDA1B1C1D1")`,
          );
        } else {
          cubeCmds.push({ pts, sideLen });
        }
      }
    } else if (words[0] === "cuboid") {
      // cuboid LxWxH new ABCDA1B1C1D1
      const dimStr = words[1] ?? "";
      const dimMatch = dimStr.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i);
      if (!dimMatch || words[2] !== "new") {
        extraErrors.push(
          `"cuboid": syntax is "cuboid LxWxH new ABCDA1B1C1D1" (e.g. "cuboid 3x4x5 new ABCDA1B1C1D1")`,
        );
      } else {
        const pts = splitPointNames(words[3] ?? "ABCDA1B1C1D1");
        if (pts.length !== 8) {
          extraErrors.push(
            `"cuboid": requires exactly 8 point names (e.g. "cuboid 3x4x5 new ABCDA1B1C1D1")`,
          );
        } else {
          cuboidCmds.push({
            pts,
            L: parseFloat(dimMatch[1]),
            W: parseFloat(dimMatch[2]),
            H: parseFloat(dimMatch[3]),
          });
        }
      }
    } else if (words[0] === "pyramid") {
      // pyramid quad [right] [L H] new SABC  |  pyramid tri [L H] new SABC
      if (words[1] !== "quad" && words[1] !== "tri") {
        extraErrors.push(
          `"pyramid": base type must be "quad" or "tri" (e.g. "pyramid quad new SABC" or "pyramid tri new SABC")`,
        );
      } else {
        const triBase = words[1] === "tri";
        let i = 2;
        const isRight = !triBase && words[i] === "right" ? (i++, true) : false;
        let baseLen = null, height = null;
        if (/^\d+(?:\.\d+)?$/.test(words[i] ?? "")) {
          baseLen = parseFloat(words[i++]);
          if (/^\d+(?:\.\d+)?$/.test(words[i] ?? ""))
            height = parseFloat(words[i++]);
        }
        if (words[i] !== "new") {
          extraErrors.push(
            `"pyramid ${words[1]}": requires "new" before the name (e.g. "pyramid ${words[1]} new SABC")`,
          );
        } else {
          const nameWord = words[i + 1] ?? "";
          const hasName = nameWord !== "" && !nameWord.startsWith(">>");
          const pts = splitPointNames(hasName ? nameWord : "SABC");
          if (pts.length !== 4) {
            extraErrors.push(
              `"pyramid ${words[1]}": requires exactly 4 point names — apex then 3 base vertices (e.g. "pyramid ${words[1]} new SABC")`,
            );
          } else {
            const internalD = triBase ? null : `__pyD_${pyramidCmds.length}__`;
            const rotCount = words.slice(i + (hasName ? 2 : 1)).filter(w => w === ">>rot").length;
            pyramidCmds.push({ pts, internalD, baseLen, height, isRight, triBase, rotCount });
          }
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
    arcLabelCmds,
    areaFillCmds,
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
    distanceCmds,
    linearPointCmds,
    secondaryPolyFigureCmds,
    arcDrawCmds,
    cubeCmds,
    cuboidCmds,
    pyramidCmds,
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
    arcLabelCmds,
    areaFillCmds,
    lineCmds,
    pointCmds,
    circlePointCmds,
    intersectPointCmds,
    drawCmds,
    circleCmds,
    inscribedCircleCmds,
    circumscribedCircleCmds,
    tangentLineCmds,
    distanceCmds,
    linearPointCmds,
    secondaryPolyFigureCmds,
    arcDrawCmds,
    cubeCmds,
    cuboidCmds,
    pyramidCmds,
    hasTriangle,
    hasQuad,
    quadResult,
    extraErrors,
  } = parseContent(content);

  const firstCmd = content.trim().split(/\s+/)[0] || "";
  if (
    firstCmd !== "triangle" &&
    firstCmd !== "circle" &&
    firstCmd !== "quadrilateral" &&
    firstCmd !== "cube" &&
    firstCmd !== "cuboid" &&
    firstCmd !== "pyramid"
  ) {
    return {
      valid: false,
      errors: [
        `Unknown shape. Only "triangle", "quadrilateral", "circle", "cube", "cuboid", and "pyramid" are supported.`,
      ],
    };
  }

  const realUnknown = unknown.filter((w) => !w.startsWith("__"));
  if (unknown.includes("__missing_new__")) {
    errors.push(
      `Basis shape must include "new" before the name (e.g. "triangle right isosceles new A[B]C")`,
    );
  }
  if (unknown.includes("__missing_label__")) {
    errors.push(
      `Basis shape requires a valid name after "new" (e.g. "circle new O-OX", "triangle new ABC")`,
    );
  }
  if (realUnknown.length > 0) {
    errors.push(
      `Unknown modifier(s): ${realUnknown.map((w) => `"${w}"`).join(", ")}`,
    );
  }

  if (hasTriangle && triMode === null) {
    const w1 = content.trim().split(/\s+/)[1] ?? "";
    if (w1.length >= 2 && /^[SA]+$/.test(w1)) {
      errors.push(
        `"triangle ${w1}": invalid combination — use SSS, SAS, ASA, or AAS`,
      );
    }
  }

  if (triMode !== null) {
    if (
      !triValues ||
      triValues.length < 3 ||
      triValues.some((v) => isNaN(v) || v <= 0)
    ) {
      errors.push(`"triangle ${triMode}": expected 3 positive numbers`);
    } else {
      if (triMode === "SSS") {
        const [a, b, c] = triValues;
        if (a + b <= c || a + c <= b || b + c <= a)
          errors.push(`"triangle SSS": triangle inequality violated`);
      } else if (triMode === "SAS") {
        const ang = triValues[1];
        if (ang <= 0 || ang >= 180)
          errors.push(
            `"triangle SAS": angle must be between 0 and 180 degrees (exclusive)`,
          );
      } else if (triMode === "ASA") {
        const [a1, , a2] = triValues;
        if (a1 <= 0 || a2 <= 0 || a1 + a2 >= 180)
          errors.push(
            `"triangle ASA": angles must be positive and sum to less than 180`,
          );
      } else if (triMode === "AAS") {
        const [a1, a2] = triValues;
        if (a1 <= 0 || a2 <= 0 || a1 + a2 >= 180)
          errors.push(
            `"triangle AAS": angles must be positive and sum to less than 180`,
          );
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
    if (!quadResult.quadType && !quadResult.quadMode) {
      errors.push(
        `"quadrilateral": shape type required (e.g., "square", "rectangle", "SSSSD", "SSSDD", "SSAAA", "SSSAA")`,
      );
    }
    if (quadResult.quadMode) {
      if (
        !quadResult.quadValues ||
        quadResult.quadValues.length < 5 ||
        quadResult.quadValues.some((v) => isNaN(v) || v <= 0)
      ) {
        errors.push(
          `"quadrilateral ${quadResult.quadMode}": expected 5 positive numbers`,
        );
      } else {
        const [v1, v2, v3, v4, v5] = quadResult.quadValues;
        if (quadResult.quadMode === "SSAAA" && v3 + v4 + v5 >= 360)
          errors.push(
            `"quadrilateral SSAAA": angles must sum to less than 360°`,
          );
        if (quadResult.quadMode === "SSSAA" && v4 + v5 >= 360)
          errors.push(
            `"quadrilateral SSSAA": angles must sum to less than 360°`,
          );
        if (
          (quadResult.quadMode === "SSAAA" ||
            quadResult.quadMode === "SSSAA") &&
          (v4 <= 0 || v5 <= 0)
        )
          errors.push(
            `"quadrilateral ${quadResult.quadMode}": angles must be positive`,
          );
      }
    }
    if (quadResult.labelStr !== null) {
      const parsed = parseQuadLabels(quadResult.labelStr);
      if (!parsed)
        errors.push(`Invalid label specification: "${quadResult.labelStr}"`);
    }
  }

  errors.push(...extraErrors);

  const vertexNames = hasQuad
    ? (
        parseQuadLabels(quadResult.labelStr) ?? [
          { label: "A" },
          { label: "B" },
          { label: "C" },
          { label: "D" },
        ]
      ).map((v) => v.label)
    : (
        parseLabels(labelStr) ?? [
          { label: "A" },
          { label: "B" },
          { label: "C" },
        ]
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
    ...cubeCmds.flatMap((c) => c.pts),
    ...cuboidCmds.flatMap((c) => c.pts),
    ...pyramidCmds.flatMap((c) => c.pts),
  ]);

  for (const { spec } of angleLabelCmds) {
    if (!isAngleSpec(spec, vertexNames, allKnownNames)) {
      errors.push(`Invalid angle specification: "${spec}"`);
    }
  }

  for (const { sideSpec } of sideLabelCmds) {
    const validTriangle = isValidSideSpec(sideSpec, vertexNames);
    const sideNames = splitPointNames(sideSpec);
    const validSegment =
      sideNames.length === 2 &&
      allKnownNames.has(sideNames[0]) &&
      allKnownNames.has(sideNames[1]) &&
      sideNames[0] !== sideNames[1];
    if (!validTriangle && !validSegment) {
      errors.push(`Invalid side specification: "${sideSpec}"`);
    }
  }
  for (const { circleName, arcPts } of arcLabelCmds) {
    const knownCircle = circleCmds.some((c) => c.name === circleName);
    if (!knownCircle)
      errors.push(`"label arc": unknown circle "${circleName}"`);
    if (
      arcPts.length !== 2 ||
      !allKnownNames.has(arcPts[0]) ||
      !allKnownNames.has(arcPts[1])
    )
      errors.push(`"label arc": invalid points "${arcPts}"`);
  }
  for (const { drawType, pts } of drawCmds) {
    if (!pts || pts.length < 2) {
      errors.push(`"line ${drawType}": expects two point names (e.g. "KL")`);
    } else if (pts[0] === pts[1]) {
      errors.push(`"line ${drawType}": both points must be different`);
    } else if (!allKnownNames.has(pts[0]) || !allKnownNames.has(pts[1])) {
      errors.push(`"line ${drawType}": unknown point(s) in "${pts.join("")}"`);
    }
  }

  for (const { sideSpec, ratioStr, name } of pointCmds) {
    const sideNames = splitPointNames(sideSpec);
    const validPointSeg =
      sideNames.length === 2 &&
      allKnownNames.has(sideNames[0]) &&
      allKnownNames.has(sideNames[1]) &&
      sideNames[0] !== sideNames[1];
    if (!isValidSideSpec(sideSpec, vertexNames) && !validPointSeg) {
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
        errors.push(
          `"point intersect": invalid segment "${seg}" — expected two known point names`,
        );
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
    const tvChars = splitPointNames(triSpec ?? "");
    if (tvChars.length !== 3 || !tvChars.every((c) => vertexNames.includes(c)))
      errors.push(`"circle inscribe": invalid triangle spec "${triSpec}"`);
    if (touchNames.length !== 0 && touchNames.length !== 3)
      errors.push(
        `"circle inscribe": expects 0 or 3 touch point names after circle name, got ${touchNames.length}`,
      );
    touchNames.forEach((n) => {
      if (!n || !/^\S+$/.test(n))
        errors.push(`"circle inscribe": invalid touch point name "${n}"`);
    });
  }

  for (const { triSpec } of circumscribedCircleCmds) {
    const tvChars = splitPointNames(triSpec ?? "");
    if (tvChars.length !== 3 || !tvChars.every((c) => vertexNames.includes(c)))
      errors.push(`"circle circumscribe": invalid triangle spec "${triSpec}"`);
  }

  for (const { lineType, triangleSpec, specWords, newNames } of lineCmds) {
    const tvChars = splitPointNames(triangleSpec ?? "");
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
    const isSideCh = (s) => {
      const pts = splitPointNames(s);
      return pts.length === 2 && isVertexCh(pts[0]) && isVertexCh(pts[1]);
    };
    if (lineType === "perpendicular bisector") {
      if (specWords.length !== 1 || !isSideCh(specWords[0]))
        errors.push(
          `"line perpendicular bisector": expects a side (e.g., "KL") before "new"`,
        );
      if (newNames.length !== 2)
        errors.push(`"line perpendicular bisector": expects 2 new point names`);
    } else if (lineType === "angle bisector") {
      if (specWords.length !== 1 || !isVertexCh(specWords[0]))
        errors.push(`"line angle bisector": expects a vertex before "new"`);
      if (newNames.length !== 1)
        errors.push(`"line angle bisector": expects 1 new point name`);
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

  for (const { type, pts } of secondaryPolyFigureCmds) {
    for (const p of pts) {
      if (!allKnownNames.has(p))
        errors.push(`"${type} ${pts.join("")}": unknown point "${p}"`);
    }
    if (new Set(pts).size !== pts.length)
      errors.push(`"${type} ${pts.join("")}": points must be distinct`);
  }

  for (const { fromPt, segPts, newName } of distanceCmds) {
    if (!allKnownNames.has(fromPt))
      errors.push(`"line distance": unknown point "${fromPt}"`);
    for (const p of segPts) {
      if (!allKnownNames.has(p))
        errors.push(`"line distance": unknown segment point "${p}"`);
    }
    if (!newName) errors.push(`"line distance": missing new point name`);
  }

  for (const { lineSpec, refPt, dist, newName } of linearPointCmds) {
    if (!allKnownNames.has(lineSpec[0]) || !allKnownNames.has(lineSpec[1]))
      errors.push(`"point ${lineSpec}": unknown line point(s)`);
    if (!allKnownNames.has(refPt))
      errors.push(
        `"point ${lineSpec} ${refPt}": unknown reference point "${refPt}"`,
      );
    if (isNaN(dist) || dist <= 0)
      errors.push(
        `"point ${lineSpec} ${refPt}": distance must be a positive number`,
      );
    if (!newName)
      errors.push(`"point ${lineSpec} ${refPt}": missing new point name`);
  }

  for (const { circleName, arcPts, style } of arcDrawCmds) {
    if (!circleCmds.some((c) => c.name === circleName))
      errors.push(`"arc": unknown circle "${circleName}"`);
    if (
      arcPts.length !== 2 ||
      !allKnownNames.has(arcPts[0]) ||
      !allKnownNames.has(arcPts[1])
    )
      errors.push(`"arc": invalid points "${arcPts}"`);
    if (!["none", "dotted", "dashed", "solid"].includes(style))
      errors.push(
        `"arc": unknown style "${style}" — use solid, dotted, dashed, or none`,
      );
  }

  for (const { pts } of cubeCmds) {
    if (new Set(pts).size !== 8)
      errors.push(`"cube": all 8 point names must be distinct`);
  }

  for (const { pts } of cuboidCmds) {
    if (new Set(pts).size !== 8)
      errors.push(`"cuboid": all 8 point names must be distinct`);
  }

  for (const { pts } of pyramidCmds) {
    if (new Set(pts).size !== 4)
      errors.push(`"pyramid quad": all 4 point names must be distinct`);
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
    arcLabelCmds,
    areaFillCmds,
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
    distanceCmds,
    linearPointCmds,
    secondaryPolyFigureCmds,
    arcDrawCmds,
    cubeCmds,
    cuboidCmds,
    pyramidCmds,
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
    const computed = computeTrianglePositions(
      triMode,
      triValues,
      triTransforms,
      size,
    );
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
    const rawPts = [
      { x: 0, y: 0, pos: "below left" },
      { x: bx, y: by, pos: bPos },
      { x: cx, y: 0, pos: "below right" },
    ];
    if (triTransforms.length > 0) {
      const transformed = applyTriTransforms(rawPts, triTransforms);
      const centX =
        (transformed[0].x + transformed[1].x + transformed[2].x) / 3;
      const centY =
        (transformed[0].y + transformed[1].y + transformed[2].y) / 3;
      positions = transformed.map((p) => ({
        x: p.x,
        y: p.y,
        pos: triLabelPos(p.x, p.y, centX, centY),
      }));
    } else {
      positions = rawPts;
    }
  } else if (hasQuad) {
    positions = quadResult.quadMode
      ? (computeQuadFreeformPositions(
          quadResult.quadMode,
          quadResult.quadValues,
          quadResult.quadTransforms,
          size,
        ) ?? [
          { x: 0, y: 0, pos: "below left" },
          { x: 0, y: 4, pos: "above left" },
          { x: 4, y: 4, pos: "above right" },
          { x: 4, y: 0, pos: "below right" },
        ])
      : computeQuadPositions(
          quadResult.quadType,
          quadResult.quadTransforms,
          size,
        );
  } else {
    positions = [];
  }

  // Effective TikZ scale factor for the shape — used to scale user-specified distances
  // (e.g. "point AB A 3 new X") so they stay in proportion at small/medium/large.
  let geoScale = 1.0;
  if (triMode) {
    // Congruence-rule triangle: scale = TRI_LONGEST_TARGET / longest raw side.
    const rawVerts = computeRawTriVerts(triMode, triValues);
    if (rawVerts) {
      const sides = [
        Math.hypot(rawVerts[1].x - rawVerts[0].x, rawVerts[1].y - rawVerts[0].y),
        Math.hypot(rawVerts[2].x - rawVerts[1].x, rawVerts[2].y - rawVerts[1].y),
        Math.hypot(rawVerts[0].x - rawVerts[2].x, rawVerts[0].y - rawVerts[2].y),
      ];
      const maxSide = Math.max(...sides);
      if (maxSide > 1e-10) geoScale = TRI_LONGEST_TARGET[size] / maxSide;
    }
  } else if (hasTriangle) {
    // Typed triangle (scalene/isosceles/equilateral): consistent per-size ratio.
    // Derived from COORDS table: small≈8/13, medium=1, large≈20/13.
    geoScale = { small: 8 / 13, medium: 1.0, large: 20 / 13 }[size];
  } else if (hasQuad) {
    if (quadResult.quadMode) {
      // Freeform quad: scale = QUAD_FREEFORM_TARGET / longest raw side.
      const rawVerts = computeRawQuadVerts(quadResult.quadMode, quadResult.quadValues);
      if (rawVerts) {
        const sides = [
          Math.hypot(rawVerts[1].x - rawVerts[0].x, rawVerts[1].y - rawVerts[0].y),
          Math.hypot(rawVerts[2].x - rawVerts[1].x, rawVerts[2].y - rawVerts[1].y),
          Math.hypot(rawVerts[3].x - rawVerts[2].x, rawVerts[3].y - rawVerts[2].y),
          Math.hypot(rawVerts[0].x - rawVerts[3].x, rawVerts[0].y - rawVerts[3].y),
        ];
        const maxSide = Math.max(...sides);
        if (maxSide > 1e-10) geoScale = QUAD_FREEFORM_TARGET[size] / maxSide;
      }
    } else {
      // Named quad type: flat scale factor.
      geoScale = QUAD_SCALE[size];
    }
  }

  // Shared size-scaled mark/arc constants (used by both angle labels and mark rendering).
  const arcBase = 0.35;
  const arcGap = 0.15;

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
  const centX =
    positions.length > 0
      ? positions.reduce((s, p) => s + p.x, 0) / positions.length
      : 0;
  const centY =
    positions.length > 0
      ? positions.reduce((s, p) => s + p.y, 0) / positions.length
      : 0;
  const ptLblOff = { small: 0.18, medium: 0.25, large: 0.38 }[size];
  const ptCmdLblOff = { small: 0.27, medium: 0.37, large: 0.57 }[size];
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
        adj1Label =
          segs[0].pts[0] === vertLabel ? segs[0].pts[1] : segs[0].pts[0];
        adj2Label =
          segs[1].pts[0] === vertLabel ? segs[1].pts[1] : segs[1].pts[0];
      }
    } else {
      [adj1Label, vertLabel, adj2Label] = splitPointNames(spec);
    }
    const vpt = lookupPt(vertLabel);
    const a1pt = lookupPt(adj1Label);
    const a2pt = lookupPt(adj2Label);
    if (!vpt || !a1pt || !a2pt) return null;
    return {
      vx: vpt.x,
      vy: vpt.y,
      a1x: a1pt.x,
      a1y: a1pt.y,
      a2x: a2pt.x,
      a2y: a2pt.y,
    };
  };

  // Pre-compute geometry for all line commands (positions of new points + segment endpoints).
  const newPtsMap = {};
  const lineGeoms = lineCmds.map(
    ({ lineType, triangleSpec, specWords, newNames }) => {
      const vp = {};
      for (const ch of splitPointNames(triangleSpec)) {
        const idx = labels.findIndex((l) => l.label === ch);
        if (idx !== -1) vp[ch] = positions[idx];
      }
      let p1 = null,
        p2 = null;
      const pts = {};
      if (lineType === "perpendicular bisector") {
        const side = splitPointNames(specWords[0]);
        const A = vp[side[0]],
          B = vp[side[1]];
        const C =
          vp[
            splitPointNames(triangleSpec).find((c) => c !== side[0] && c !== side[1])
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
        const V = vp[specWords[0]];
        const [oCh1, oCh2] = splitPointNames(triangleSpec)
          .filter((c) => c !== specWords[0]);
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
        if (newNames[0]) pts[newNames[0]] = G;
      } else if (lineType === "median") {
        const V = vp[specWords[0]];
        const [oCh1, oCh2] = splitPointNames(triangleSpec)
          .filter((c) => c !== specWords[0]);
        const L = vp[oCh1],
          M = vp[oCh2];
        const G = { x: (L.x + M.x) / 2, y: (L.y + M.y) / 2 };
        p1 = V;
        p2 = G;
        if (newNames[0]) pts[newNames[0]] = G;
      } else if (lineType === "altitude") {
        const V = vp[specWords[0]];
        const [oCh1, oCh2] = splitPointNames(triangleSpec)
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

  // Register cube vertex positions (must precede pointCmds so lookupPt finds them).
  if (cubeCmds.length > 0) {
    const defaultS = { small: 2.46, medium: 4, large: 6.15 }[size];
    for (const { pts, sideLen } of cubeCmds) {
      const cubeS  = sideLen ?? defaultS;
      const cubeDX = cubeS * 0.5;
      const cubeDY = cubeS * 0.325;
      const [pA, pB, pC, pD, pA1, pB1, pC1, pD1] = pts;
      newPtsMap[pA]  = { x: 0,                 y: 0,                pos: "below left"  };
      newPtsMap[pB]  = { x: cubeDX,            y: cubeDY,           pos: "below"       };
      newPtsMap[pC]  = { x: cubeS + cubeDX,    y: cubeDY,           pos: "below right" };
      newPtsMap[pD]  = { x: cubeS,             y: 0,                pos: "below right" };
      newPtsMap[pA1] = { x: 0,                 y: cubeS,            pos: "above left"  };
      newPtsMap[pB1] = { x: cubeDX,            y: cubeS + cubeDY,   pos: "above left"  };
      newPtsMap[pC1] = { x: cubeS + cubeDX,    y: cubeS + cubeDY,   pos: "above right" };
      newPtsMap[pD1] = { x: cubeS,             y: cubeS,            pos: "above"       };
    }
  }

  // Register pyramid vertex positions (must precede pointCmds).
  if (pyramidCmds.length > 0) {
    const cubeScale = { small: 2.46, medium: 4, large: 6.15 }[size];
    const sizeScale = cubeScale / 4; // 1.0 at medium; explicit dims are in medium units
    for (const { pts, internalD, baseLen, height, isRight, triBase, rotCount } of pyramidCmds) {
      const [pS, pA, pB, pC] = pts;
      if (triBase) {
        const L = baseLen != null ? baseLen * sizeScale : cubeScale * 1.75;
        const H = height  != null ? height  * sizeScale : cubeScale * 1.5;
        const bY = L * 2.25 / 7;
        if (rotCount === 1) {
          const rotW = L * 6 / 7;
          newPtsMap[pA] = { x: 0,             y: 0,            pos: "below left"  };
          newPtsMap[pB] = { x: rotW * 11/18,  y: L * 2.609/7,  pos: "left"        };
          newPtsMap[pC] = { x: rotW,          y: 0,            pos: "below right" };
          newPtsMap[pS] = { x: rotW / 2,      y: H,            pos: "above"       };
        } else if (rotCount >= 2) {
          newPtsMap[pA] = { x: L * 4/7,  y: -L / 14,  pos: "below"  };
          newPtsMap[pB] = { x: 0,        y: bY,        pos: "left"   };
          newPtsMap[pC] = { x: L * 6/7,  y: bY,        pos: "right"  };
          newPtsMap[pS] = { x: L * 3/7,  y: H,         pos: "above"  };
        } else {
          const aX = L * 2 / 7;
          newPtsMap[pA] = { x: aX, y: 0,   pos: "below"  };
          newPtsMap[pB] = { x: 0,  y: bY,  pos: "left"   };
          newPtsMap[pC] = { x: L,  y: bY,  pos: "right"  };
          newPtsMap[pS] = { x: (aX + L) / 3, y: H, pos: "above" };
        }
      } else {
        const L = baseLen != null ? baseLen * sizeScale : cubeScale;
        const H = height  != null ? height  * sizeScale : cubeScale;
        const dX = L * 0.5;
        const dY = L * 0.325;
        newPtsMap[pA]        = { x: 0,      y: 0,   pos: "below left"  };
        newPtsMap[pB]        = { x: dX,     y: dY,  pos: "left"        };
        newPtsMap[pC]        = { x: L,      y: 0,   pos: "below right" };
        newPtsMap[internalD] = { x: L + dX, y: dY                      };
        newPtsMap[pS]        = isRight
          ? { x: dX,              y: dY + H,     pos: "above left" }
          : { x: (L + dX) / 2,   y: dY / 2 + H, pos: "above"      };
      }
    }
  }

  // Expand pyramid into draw commands — just edges, solid or dashed.
  for (const { pts, internalD, triBase, rotCount } of pyramidCmds) {
    const [pS, pA, pB, pC] = pts;
    const seg = (a, b, dashed = false) =>
      drawCmds.push({ drawType: "segment", pts: [a, b], lineStyle: dashed ? "dashed" : null });
    if (triBase) {
      if (rotCount === 1) {
        seg(pA, pB, true);  seg(pB, pC, true);  seg(pC, pA);
        seg(pC, pS);        seg(pA, pS);         seg(pB, pS, true);
      } else {
        // default and >>rot >>rot
        seg(pC, pA);        seg(pA, pB);         seg(pB, pC, true);
        seg(pC, pS);        seg(pA, pS);         seg(pB, pS);
      }
    } else {
      const pD = internalD;
      seg(pA, pS);   seg(pS, pC);   seg(pC, pA);
      seg(pB, pS, true);  seg(pS, pD);   seg(pC, pD);
      seg(pD, pB, true);  seg(pA, pB, true);
    }
  }

  // Register cuboid vertex positions (must precede pointCmds).
  for (const { pts, L, W, H } of cuboidCmds) {
    const [pA, pB, pC, pD, pA1, pB1, pC1, pD1] = pts;
    const dX = W / 2;
    const dY = 1.3 * W / 4;
    newPtsMap[pA]  = { x: 0,       y: 0,        pos: "below left"  };
    newPtsMap[pB]  = { x: dX,      y: dY,       pos: "below"       };
    newPtsMap[pC]  = { x: L + dX,  y: dY,       pos: "below right" };
    newPtsMap[pD]  = { x: L,       y: 0,        pos: "below right" };
    newPtsMap[pA1] = { x: 0,       y: H,        pos: "above left"  };
    newPtsMap[pB1] = { x: dX,      y: H + dY,   pos: "above left"  };
    newPtsMap[pC1] = { x: L + dX,  y: H + dY,   pos: "above right" };
    newPtsMap[pD1] = { x: L,       y: H,        pos: "above"       };
  }

  // Compute positions for explicit points on sides.
  for (const { sideSpec, ratioStr, name } of pointCmds) {
    const [r1, r2] = ratioStr.split(":").map(Number);
    const t = r1 / (r1 + r2);
    const [sp0, sp1] = splitPointNames(sideSpec);
    const p1 = lookupPt(sp0);
    const p2 = lookupPt(sp1);
    if (p1 && p2) {
      newPtsMap[name] = {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
      };
    }
  }

  // Circle point positions must be in newPtsMap before draw commands run.
  const circleR = { small: 1.5, medium: 2.0, large: 3.8 }[size];
  for (const { center, northPt, fromExisting, customRadius } of circleCmds) {
    if (fromExisting) {
      // Points already exist; tag northPt with originX/originY for arc detection.
      const cp = lookupPt(center);
      const np = northPt ? lookupPt(northPt) : null;
      if (cp && np && !newPtsMap[northPt])
        newPtsMap[northPt] = { ...np, originX: cp.x, originY: cp.y };
      else if (cp && np)
        newPtsMap[northPt] = {
          ...newPtsMap[northPt],
          originX: cp.x,
          originY: cp.y,
        };
    } else {
      const R = customRadius ?? circleR;
      newPtsMap[center] = { x: 0, y: 0, pos: "below" };
      if (northPt)
        newPtsMap[northPt] = {
          x: R,
          y: 0,
          originX: 0,
          originY: 0,
          pos: "right",
        };
    }
  }

  const getCircleR = (circleCmd) => {
    if (!circleCmd.fromExisting) return circleCmd.customRadius ?? circleR;
    const cp = lookupPt(circleCmd.center),
      np = circleCmd.northPt ? lookupPt(circleCmd.northPt) : null;
    return cp && np ? Math.hypot(cp.x - np.x, cp.y - np.y) : circleR;
  };

  // Compute positions for explicit points on circles.
  for (const { circleName, angleStr, name } of circlePointCmds) {
    const circleCmd = circleCmds.find((c) => c.name === circleName);
    if (!circleCmd) continue;
    const center = lookupPt(circleCmd.center);
    if (!center) continue;
    const R = getCircleR(circleCmd);
    const hScale = circleCmd.hScale ?? 1;
    const rad = (parseFloat(angleStr) * Math.PI) / 180;
    newPtsMap[name] = {
      x: center.x + R * Math.cos(rad),
      y: center.y + R * hScale * Math.sin(rad),
      originX: center.x,
      originY: center.y,
    };
  }

  // Compute foot-of-perpendicular for "line distance" commands.
  for (const { fromPt, segPts, newName } of distanceCmds) {
    const C = lookupPt(fromPt);
    const L = lookupPt(segPts[0]);
    const M = lookupPt(segPts[1]);
    if (!C || !L || !M) continue;
    const ex = M.x - L.x, ey = M.y - L.y;
    const len2 = ex * ex + ey * ey;
    if (len2 < 1e-12) continue;
    const t = ((C.x - L.x) * ex + (C.y - L.y) * ey) / len2;
    newPtsMap[newName] = { x: L.x + t * ex, y: L.y + t * ey };
  }

  // Compute linear points: point on a line at a given distance from a reference point.
  // dist is specified in medium-scale units; multiply by geoScale to match rendered size.
  for (const { lineSpec, refPt, dist, left, newName } of linearPointCmds) {
    const A = lookupPt(lineSpec[0]);
    const B = lookupPt(lineSpec[1]);
    const R = lookupPt(refPt);
    if (!A || !B || !R) continue;
    const ex = B.x - A.x, ey = B.y - A.y;
    const len = Math.hypot(ex, ey);
    if (len < 1e-10) continue;
    const ux = ex / len, uy = ey / len;
    const sign = left ? -1 : 1;
    const scaledDist = dist * geoScale;
    newPtsMap[newName] = {
      x: R.x + sign * scaledDist * ux,
      y: R.y + sign * scaledDist * uy,
    };
  }

  // Tangent line: place new point B along the tangent at the given circle point.
  for (const { circleName, pointName, newName } of tangentLineCmds) {
    const circleCmd = circleCmds.find((c) => c.name === circleName);
    if (!circleCmd) continue;
    const center = lookupPt(circleCmd.center);
    const pt = lookupPt(pointName);
    if (!center || !pt) continue;
    const rdx = pt.x - center.x,
      rdy = pt.y - center.y;
    const rlen = Math.hypot(rdx, rdy);
    if (rlen < 1e-10) continue;
    const tx = -rdy / rlen,
      ty = rdx / rlen;
    const bOff = circleR * 0.7;
    newPtsMap[newName] = {
      x: pt.x + bOff * tx,
      y: pt.y + bOff * ty,
      originX: center.x,
      originY: center.y,
    };
  }

  // Compute positions for line-line intersection points (after all other points are placed).
  for (const { spec1, spec2, name } of intersectPointCmds) {
    const p1 = lookupPt(spec1[0]),
      p2 = lookupPt(spec1[1]);
    const p3 = lookupPt(spec2[0]),
      p4 = lookupPt(spec2[1]);
    if (!p1 || !p2 || !p3 || !p4) continue;
    const ex = p2.x - p1.x,
      ey = p2.y - p1.y;
    const fx = p4.x - p3.x,
      fy = p4.y - p3.y;
    const det = ey * fx - ex * fy;
    if (Math.abs(det) < 1e-10) continue; // parallel
    const gx = p3.x - p1.x,
      gy = p3.y - p1.y;
    const t = (gy * fx - gx * fy) / det;
    newPtsMap[name] = { x: p1.x + t * ex, y: p1.y + t * ey };
  }

  // Inscribed and circumscribed circles: compute geometry from triangle positions.
  const computedCircleGeoms = [];
  for (const { triSpec, center, northPt, touchNames } of inscribedCircleCmds) {
    const triIdx = splitPointNames(triSpec)
      .map((c) => labels.findIndex((l) => l.label === c));
    if (triIdx.some((i) => i === -1)) continue;
    const [A, B, C] = triIdx.map((i) => positions[i]);
    const a = Math.hypot(C.x - B.x, C.y - B.y);
    const b = Math.hypot(A.x - C.x, A.y - C.y);
    const c2 = Math.hypot(B.x - A.x, B.y - A.y);
    const s = (a + b + c2) / 2;
    const area =
      Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
    const r = area / s;
    const cx = (a * A.x + b * B.x + c2 * C.x) / (a + b + c2);
    const cy = (a * A.y + b * B.y + c2 * C.y) / (a + b + c2);
    const tcx = (A.x + B.x + C.x) / 3,
      tcy = (A.y + B.y + C.y) / 3;
    newPtsMap[center] = { x: cx, y: cy, pos: triLabelPos(cx, cy, tcx, tcy) };
    if (northPt)
      newPtsMap[northPt] = {
        x: cx + r,
        y: cy,
        originX: cx,
        originY: cy,
        pos: "right",
      };
    if (touchNames.length >= 3) {
      // touch on BC (side a): from B, distance s-b
      const tBC = (s - b) / a;
      newPtsMap[touchNames[0]] = {
        x: B.x + tBC * (C.x - B.x),
        y: B.y + tBC * (C.y - B.y),
        originX: cx,
        originY: cy,
      };
      // touch on CA (side b): from C, distance s-c2
      const tCA = (s - c2) / b;
      newPtsMap[touchNames[1]] = {
        x: C.x + tCA * (A.x - C.x),
        y: C.y + tCA * (A.y - C.y),
        originX: cx,
        originY: cy,
      };
      // touch on AB (side c): from A, distance s-a
      const tAB = (s - a) / c2;
      newPtsMap[touchNames[2]] = {
        x: A.x + tAB * (B.x - A.x),
        y: A.y + tAB * (B.y - A.y),
        originX: cx,
        originY: cy,
      };
    }
    computedCircleGeoms.push({ cx, cy, r });
  }
  for (const { triSpec, center, northPt } of circumscribedCircleCmds) {
    const triIdx = splitPointNames(triSpec)
      .map((c) => labels.findIndex((l) => l.label === c));
    if (triIdx.some((i) => i === -1)) continue;
    const [A, B, C] = triIdx.map((i) => positions[i]);
    const ax = B.x - A.x,
      ay = B.y - A.y;
    const bx = C.x - A.x,
      by = C.y - A.y;
    const D = 2 * (ax * by - ay * bx);
    if (Math.abs(D) < 1e-10) continue;
    const ux = (by * (ax * ax + ay * ay) - ay * (bx * bx + by * by)) / D;
    const uy = (ax * (bx * bx + by * by) - bx * (ax * ax + ay * ay)) / D;
    const cx = A.x + ux,
      cy = A.y + uy;
    const r = Math.hypot(A.x - cx, A.y - cy);
    const tcx = (A.x + B.x + C.x) / 3,
      tcy = (A.y + B.y + C.y) / 3;
    newPtsMap[center] = { x: cx, y: cy, pos: triLabelPos(cx, cy, tcx, tcy) };
    if (northPt)
      newPtsMap[northPt] = {
        x: cx + r,
        y: cy,
        originX: cx,
        originY: cy,
        pos: "right",
      };
    computedCircleGeoms.push({ cx, cy, r });
  }

  // Bounding box of all content, used to clip full-line draw commands.
  const bbMargin = { small: 0.5, medium: 0.8, large: 1.2 }[size];
  const bbPts = [
    ...(hasTriangle || hasQuad ? positions : []),
    ...Object.values(newPtsMap),
  ];
  for (const circleCmd of circleCmds) {
    const cp = lookupPt(circleCmd.center);
    if (cp) {
      const R = getCircleR(circleCmd);
      bbPts.push({ x: cp.x - R, y: cp.y });
      bbPts.push({ x: cp.x + R, y: cp.y });
      bbPts.push({ x: cp.x, y: cp.y - R });
      bbPts.push({ x: cp.x, y: cp.y + R });
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

  // Returns per-edge arc direction: "cw", "ccw", or null (=shorter arc) for non-arc edges.
  const resolveAreaArcDirs = (pts) => {
    const n = pts.length;
    const isArcEdge = (i) => {
      const na = pts[i],
        nb = pts[(i + 1) % n];
      const curr = lookupPt(na),
        next = lookupPt(nb);
      if (!curr || !next) return false;
      const hasExplicit = drawCmds.some(
        (d) =>
          (d.drawType === "segment" ||
            d.drawType === "line" ||
            d.drawType === "ray") &&
          ((d.pts[0] === na && d.pts[1] === nb) ||
            (d.pts[0] === nb && d.pts[1] === na)),
      );
      return (
        !hasExplicit &&
        curr.originX !== undefined &&
        next.originX !== undefined &&
        Math.abs(curr.originX - next.originX) < 1e-6 &&
        Math.abs(curr.originY - next.originY) < 1e-6
      );
    };
    const arcEdge = Array.from({ length: n }, (_, i) => isArcEdge(i));
    const dirs = new Array(n).fill(null);
    const visited = new Array(n).fill(false);
    for (let start = 0; start < n; start++) {
      if (!arcEdge[start] || visited[start]) continue;
      let len = 0;
      while (
        arcEdge[(start + len) % n] &&
        !visited[(start + len) % n] &&
        len < n
      )
        len++;
      if (len < 2) {
        visited[start] = true;
        continue;
      }
      // Points in run: pts[start..start+len]
      const runPts = Array.from({ length: len + 1 }, (_, k) =>
        lookupPt(pts[(start + k) % n]),
      );
      const p0 = runPts[0];
      const ox = p0.originX,
        oy = p0.originY;
      const a0 = (Math.atan2(p0.y - oy, p0.x - ox) * 180) / Math.PI;
      const relCCW = runPts.map(
        (p) =>
          ((((Math.atan2(p.y - oy, p.x - ox) * 180) / Math.PI - a0) % 360) +
            360) %
          360,
      );
      const relCW = runPts.map(
        (p) =>
          (((a0 - (Math.atan2(p.y - oy, p.x - ox) * 180) / Math.PI) % 360) +
            360) %
          360,
      );
      const isCCW = relCCW.every((v, i) => i === 0 || v >= relCCW[i - 1]);
      const isCW = relCW.every((v, i) => i === 0 || v >= relCW[i - 1]);
      const dir = isCCW ? "ccw" : isCW ? "cw" : null;
      for (let k = 0; k < len; k++) {
        dirs[(start + k) % n] = dir;
        visited[(start + k) % n] = true;
      }
    }
    return dirs;
  };

  const arcAngles = (curr, next, dir) => {
    const cx = curr.originX,
      cy = curr.originY;
    const R = Math.hypot(curr.x - cx, curr.y - cy);
    let angA = (Math.atan2(curr.y - cy, curr.x - cx) * 180) / Math.PI;
    let angB = (Math.atan2(next.y - cy, next.x - cx) * 180) / Math.PI;
    if (dir === "ccw") {
      while (angB <= angA) angB += 360;
    } else if (dir === "cw") {
      while (angB >= angA) angB -= 360;
    } else {
      while (angB < angA) angB += 360;
      if (angB - angA > 180) angB -= 360;
    }
    return { angA, angB, cx, cy, R };
  };

  const buildAreaPath = (pts) => {
    const first = lookupPt(pts[0]);
    if (!first) return null;
    const n = pts.length;
    const dirs = resolveAreaArcDirs(pts);
    let path = `(${f(first.x)},${f(first.y)})`;
    for (let i = 0; i < n; i++) {
      const curr = lookupPt(pts[i]);
      const next = lookupPt(pts[(i + 1) % n]);
      if (!curr || !next) continue;
      const na = pts[i],
        nb = pts[(i + 1) % n];
      const hasExplicit = drawCmds.some(
        (d) =>
          (d.drawType === "segment" ||
            d.drawType === "line" ||
            d.drawType === "ray") &&
          ((d.pts[0] === na && d.pts[1] === nb) ||
            (d.pts[0] === nb && d.pts[1] === na)),
      );
      const isArcEdge =
        !hasExplicit &&
        curr.originX !== undefined &&
        next.originX !== undefined &&
        Math.abs(curr.originX - next.originX) < 1e-6 &&
        Math.abs(curr.originY - next.originY) < 1e-6;
      if (isArcEdge) {
        const { angA, angB, R } = arcAngles(curr, next, dirs[i]);
        path += ` arc (${f(angA)}:${f(angB)}:${f(R)})`;
      } else if (i === n - 1) {
        path += ` -- cycle`;
      } else {
        path += ` -- (${f(next.x)},${f(next.y)})`;
      }
    }
    if (!path.endsWith("cycle")) path += ` -- cycle`;
    return path;
  };

  const buildFillLines = () => {
    const out = [];
    for (const { pts, style } of areaFillCmds) {
      if (pts.length < 2 || style === "none") continue;
      const path = buildAreaPath(pts);
      if (!path) continue;
      if (style === "solid light") {
        out.push(`\\fill[gray!25] ${path};`);
      } else {
        out.push(`\\fill[gray!55] ${path};`);
      }
    }
    return out;
  };

  const consumedDrawCmds = new Set();

  // Returns the lineStyle of a drawCmd that overrides this side, or null.
  // Marks that cmd as consumed so it isn't redrawn in the drawCmds loop.
  const consumeSideStyle = (la, lb) => {
    const cmd = drawCmds.find(
      (d) =>
        (d.drawType === "segment" || d.drawType === "line") &&
        d.lineStyle &&
        ((d.pts[0] === la && d.pts[1] === lb) ||
          (d.pts[0] === lb && d.pts[1] === la)),
    );
    if (cmd) {
      consumedDrawCmds.add(cmd);
      return cmd.lineStyle;
    }
    return null;
  };

  const lines = [...buildFillLines()];
  if (hasTriangle) {
    const [p0, p1, p2] = positions;
    const [la, lb, lc] = labels.map((v) => v.label);
    for (const [pt1, pt2, a, b] of [
      [p0, p1, la, lb],
      [p1, p2, lb, lc],
      [p2, p0, lc, la],
    ]) {
      const style = consumeSideStyle(a, b);
      const sa =
        style === "dashed" ? ",dashed" : style === "dotted" ? ",dotted" : "";
      lines.push(
        `\\draw[line width=1.5pt${sa}] (${f(pt1.x)},${f(pt1.y)}) -- (${f(pt2.x)},${f(pt2.y)});`,
      );
    }
  } else if (hasQuad) {
    const [p0, p1, p2, p3] = positions;
    const [la, lb, lc, ld] = labels.map((v) => v.label);
    for (const [pt1, pt2, a, b] of [
      [p0, p1, la, lb],
      [p1, p2, lb, lc],
      [p2, p3, lc, ld],
      [p3, p0, ld, la],
    ]) {
      const style = consumeSideStyle(a, b);
      const sa =
        style === "dashed" ? ",dashed" : style === "dotted" ? ",dotted" : "";
      lines.push(
        `\\draw[line width=1.5pt${sa}] (${f(pt1.x)},${f(pt1.y)}) -- (${f(pt2.x)},${f(pt2.y)});`,
      );
    }
  }

  // Secondary triangle/quadrilateral outlines from existing points.
  if (secondaryPolyFigureCmds.length > 0) {
    lines.push("");
    for (const { pts } of secondaryPolyFigureCmds) {
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const p1 = lookupPt(pts[i]),
          p2 = lookupPt(pts[(i + 1) % n]);
        if (!p1 || !p2) continue;
        lines.push(
          `\\draw[line width=1.5pt] (${f(p1.x)},${f(p1.y)}) -- (${f(p2.x)},${f(p2.y)});`,
        );
      }
    }
  }

  // A segment suppresses any line/ray/tangent whose infinite line it lies on (geometric check).
  const segmentEndpoints = drawCmds
    .filter((d) => d.drawType === "segment")
    .map((d) => ({ sp1: lookupPt(d.pts[0]), sp2: lookupPt(d.pts[1]) }))
    .filter(({ sp1, sp2 }) => sp1 && sp2);
  const segmentCoversLine = (lp1, lp2) => {
    const dx = lp2.x - lp1.x,
      dy = lp2.y - lp1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-10) return false;
    return segmentEndpoints.some(
      ({ sp1, sp2 }) =>
        Math.abs(dx * (sp1.y - lp1.y) - dy * (sp1.x - lp1.x)) / len < 1e-6 &&
        Math.abs(dx * (sp2.y - lp1.y) - dy * (sp2.x - lp1.x)) / len < 1e-6,
    );
  };

  // Direct line / segment / ray draw commands.
  const arrowHeads = [];
  if (drawCmds.length > 0) {
    const extAmt = { small: 0.5, medium: 0.8, large: 1.2 }[size];
    lines.push("");
    for (const cmd of drawCmds) {
      if (consumedDrawCmds.has(cmd)) continue;
      const { drawType, pts, lineStyle } = cmd;
      const idx1 = labels.findIndex((v) => v.label === pts[0]);
      const idx2 = labels.findIndex((v) => v.label === pts[1]);
      const p1 = idx1 !== -1 ? positions[idx1] : (newPtsMap[pts[0]] ?? null);
      const p2 = idx2 !== -1 ? positions[idx2] : (newPtsMap[pts[1]] ?? null);
      if (!p1 || !p2) continue;
      if (
        drawType !== "segment" &&
        drawType !== "arrow" &&
        segmentCoversLine(p1, p2)
      )
        continue;
      const dx = p2.x - p1.x,
        dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-10) continue;
      const ux = dx / len,
        uy = dy / len;
      const styleAttr =
        lineStyle === "dashed"
          ? ",dashed"
          : lineStyle === "dotted"
            ? ",dotted"
            : "";
      if (drawType === "arrow") {
        const aLen = 0.3,
          aWid = 0.13;
        const bx = p2.x - aLen * ux,
          by = p2.y - aLen * uy;
        const lx = bx - aWid * uy,
          ly = by + aWid * ux;
        const rx = bx + aWid * uy,
          ry = by - aWid * ux;
        lines.push(
          `\\draw[line width=1pt${styleAttr}] (${f(p1.x)},${f(p1.y)}) -- (${f(bx)},${f(by)});`,
        );
        arrowHeads.push(
          `\\fill (${f(p2.x)},${f(p2.y)}) -- (${f(lx)},${f(ly)}) -- (${f(rx)},${f(ry)}) -- cycle;`,
        );
      } else if (drawType === "segment") {
        lines.push(
          `\\draw[line width=1pt${styleAttr}] (${f(p1.x)},${f(p1.y)}) -- (${f(p2.x)},${f(p2.y)});`,
        );
      } else if (drawType === "ray") {
        const ex = p2.x + extAmt * ux,
          ey = p2.y + extAmt * uy;
        lines.push(
          `\\draw[line width=1pt${styleAttr}] (${f(p1.x)},${f(p1.y)}) -- (${f(ex)},${f(ey)});`,
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
          `\\draw[line width=1pt${styleAttr}] (${f(p1.x + tMin * ux)},${f(p1.y + tMin * uy)}) -- (${f(p1.x + tMax * ux)},${f(p1.y + tMax * uy)});`,
        );
      }
    }
  }

  // Circles: draw the circle (or visible arc if hidden); register center + north point as named points.
  if (circleCmds.length > 0) {
    lines.push("");
    for (const circleCmd of circleCmds) {
      const { center, northPt, fromExisting, name } = circleCmd;
      const hScale = circleCmd.hScale ?? 1;
      let ccx, ccy, R;
      if (fromExisting) {
        const cp = lookupPt(center);
        if (!cp) continue;
        ccx = cp.x;
        ccy = cp.y;
        R = getCircleR(circleCmd);
      } else {
        ccx = 0;
        ccy = 0;
        R = circleCmd.customRadius ?? circleR;
        // center and northPt already registered in early-init; don't re-overwrite
        // so that circlePointCmds overrides (e.g. "point O-OX 180 new X") are preserved.
      }
      const Ry = R * hScale;
      const circleArcCmds = arcDrawCmds.filter((a) => a.circleName === name);
      if (circleArcCmds.length > 0) {
        const normDeg = (a) => ((a % 360) + 360) % 360;
        for (const { arcPts, bigger, style } of circleArcCmds) {
          if (style === "none") continue;
          const pA = lookupPt(arcPts[0]);
          const pB = lookupPt(arcPts[1]);
          if (!pA || !pB) continue;
          // Recover parametric angles by un-scaling Y
          const θA = normDeg(
            (Math.atan2((pA.y - ccy) / hScale, pA.x - ccx) * 180) / Math.PI,
          );
          const θB = normDeg(
            (Math.atan2((pB.y - ccy) / hScale, pB.x - ccx) * 180) / Math.PI,
          );
          const sweep = (θB - θA + 360) % 360;
          let startDeg, endDeg;
          if (!bigger) {
            if (sweep <= 180) { startDeg = θA; endDeg = θA + sweep; }
            else { startDeg = θB; endDeg = θB + (360 - sweep); }
          } else {
            if (sweep <= 180) { startDeg = θB; endDeg = θB + (360 - sweep); }
            else { startDeg = θA; endDeg = θA + sweep; }
          }
          const styleStr =
            style === "dotted" ? ",dotted" : style === "dashed" ? ",dashed" : "";
          const sx = f(ccx + R * Math.cos((startDeg * Math.PI) / 180));
          const sy = f(ccy + Ry * Math.sin((startDeg * Math.PI) / 180));
          lines.push(
            `\\draw[line width=1.5pt${styleStr}] (${sx},${sy}) arc [start angle=${f(startDeg)}, end angle=${f(endDeg)}, x radius=${f(R)}, y radius=${f(Ry)}];`,
          );
        }
      } else {
        if (hScale !== 1) {
          lines.push(
            `\\draw[line width=1.5pt] (${f(ccx)},${f(ccy)}) ellipse (${f(R)} and ${f(Ry)});`,
          );
        } else {
          lines.push(
            `\\draw[line width=1.5pt] (${f(ccx)},${f(ccy)}) circle (${f(R)});`,
          );
        }
      }
    }
  }
  // Inscribed / circumscribed circles.
  if (computedCircleGeoms.length > 0) {
    lines.push("");
    for (const { cx, cy, r } of computedCircleGeoms) {
      lines.push(
        `\\draw[line width=1.5pt] (${f(cx)},${f(cy)}) circle (${f(r)});`,
      );
    }
  }
  // Cube: draw all 12 edges with hidden-line dashing.
  if (cubeCmds.length > 0) {
    lines.push("");
    for (const { pts } of cubeCmds) {
      const [pA, pB, pC, pD, pA1, pB1, pC1, pD1] = pts;
      const w = "line width=1.5pt";
      const wd = "line width=1.5pt, dashed";
      const e = (s, a, b) => `\\draw[${s}] (${f(newPtsMap[a].x)},${f(newPtsMap[a].y)}) -- (${f(newPtsMap[b].x)},${f(newPtsMap[b].y)});`;
      // Front face A-A1-D1-D (all solid)
      lines.push(e(w,  pA,  pA1));
      lines.push(e(w,  pA1, pD1));
      lines.push(e(w,  pD1, pD));
      lines.push(e(w,  pD,  pA));
      lines.push("");
      // Back face B-B1-C1-C: B-B1 and C-B hidden, rest solid
      lines.push(e(wd, pB,  pB1));
      lines.push(e(w,  pB1, pC1));
      lines.push(e(w,  pC1, pC));
      lines.push(e(wd, pC,  pB));
      lines.push("");
      // Depth edges: A-B hidden; A1-B1, D1-C1, D-C solid
      lines.push(e(wd, pA,  pB));
      lines.push(e(w,  pA1, pB1));
      lines.push(e(w,  pD1, pC1));
      lines.push(e(w,  pD,  pC));
    }
  }

  // Cuboid: same hidden-line convention as cube.
  if (cuboidCmds.length > 0) {
    lines.push("");
    for (const { pts } of cuboidCmds) {
      const [pA, pB, pC, pD, pA1, pB1, pC1, pD1] = pts;
      const w = "line width=1.5pt";
      const wd = "line width=1.5pt, dashed";
      const e = (s, a, b) => `\\draw[${s}] (${f(newPtsMap[a].x)},${f(newPtsMap[a].y)}) -- (${f(newPtsMap[b].x)},${f(newPtsMap[b].y)});`;
      // Front face A-A1-D1-D (all solid)
      lines.push(e(w,  pA,  pA1));
      lines.push(e(w,  pA1, pD1));
      lines.push(e(w,  pD1, pD));
      lines.push(e(w,  pD,  pA));
      lines.push("");
      // Back face B-B1-C1-C: B-B1 and C-B hidden, rest solid
      lines.push(e(wd, pB,  pB1));
      lines.push(e(w,  pB1, pC1));
      lines.push(e(w,  pC1, pC));
      lines.push(e(wd, pC,  pB));
      lines.push("");
      // Depth edges: A-B hidden; A1-B1, D1-C1, D-C solid
      lines.push(e(wd, pA,  pB));
      lines.push(e(w,  pA1, pB1));
      lines.push(e(w,  pD1, pC1));
      lines.push(e(w,  pD,  pC));
    }
  }

  // Tangent lines: drawn as full lines clipped to the padded bounding box.
  if (tangentLineCmds.length > 0) {
    lines.push("");
    for (const { circleName, pointName, newName } of tangentLineCmds) {
      const lp1 = lookupPt(pointName),
        lp2 = lookupPt(newName);
      if (lp1 && lp2 && segmentCoversLine(lp1, lp2)) continue;
      const circleCmd = circleCmds.find((c) => c.name === circleName);
      if (!circleCmd) continue;
      const center = lookupPt(circleCmd.center);
      const pt = lookupPt(pointName);
      if (!center || !pt) continue;
      const rdx = pt.x - center.x,
        rdy = pt.y - center.y;
      const rlen = Math.hypot(rdx, rdy);
      if (rlen < 1e-10) continue;
      const tx = -rdy / rlen,
        ty = rdx / rlen;
      let tMin = -Infinity,
        tMax = Infinity;
      if (Math.abs(tx) > 1e-10) {
        const ta = (bbX0 - pt.x) / tx,
          tb = (bbX1 - pt.x) / tx;
        tMin = Math.max(tMin, Math.min(ta, tb));
        tMax = Math.min(tMax, Math.max(ta, tb));
      }
      if (Math.abs(ty) > 1e-10) {
        const ta = (bbY0 - pt.y) / ty,
          tb = (bbY1 - pt.y) / ty;
        tMin = Math.max(tMin, Math.min(ta, tb));
        tMax = Math.min(tMax, Math.max(ta, tb));
      }
      if (tMin >= tMax) continue;
      lines.push(
        `\\draw[line width=1pt] (${f(pt.x + tMin * tx)},${f(pt.y + tMin * ty)}) -- (${f(pt.x + tMax * tx)},${f(pt.y + tMax * ty)});`,
      );
    }
  }

  // Arrowheads: drawn after all strokes so they paint over everything.
  if (arrowHeads.length > 0) {
    lines.push("");
    for (const h of arrowHeads) lines.push(h);
  }

  lines.push("");

  for (const { spec, text, labelPos } of vertexLabelCmds) {
    const idx = labels.findIndex((v) => v.label === spec);
    if (idx !== -1) {
      const { x, y, pos } = positions[idx];
      lines.push(
        `\\node[${labelPos ?? pos}, scale=1.5] at (${f(x)},${f(y)}) {$${text ?? defaultLabelText(spec)}$};`,
      );
    } else if (newPtsMap[spec]) {
      const pt = newPtsMap[spec];
      if (labelPos) {
        lines.push(
          `\\node[${labelPos}, scale=1.5] at (${f(pt.x)},${f(pt.y)}) {$${text ?? defaultLabelText(spec)}$};`,
        );
        continue;
      }
      if (pt.pos) {
        lines.push(
          `\\node[${pt.pos}, scale=1.5] at (${f(pt.x)},${f(pt.y)}) {$${text ?? defaultLabelText(spec)}$};`,
        );
        continue;
      }
      let outDx, outDy;
      const ptCmd = pointCmdByName[spec];
      if (ptCmd) {
        const [sn0, sn1] = splitPointNames(ptCmd.sideSpec);
        const sp1 = lookupPt(sn0);
        const sp2 = lookupPt(sn1);
        const sdx = sp2.x - sp1.x,
          sdy = sp2.y - sp1.y;
        const slen = Math.hypot(sdx, sdy);
        const px = -sdy / slen,
          py = sdx / slen;
        const sign = px * (pt.x - centX) + py * (pt.y - centY) >= 0 ? 1 : -1;
        outDx = sign * px;
        outDy = sign * py;
      } else {
        const ox = pt.originX ?? centX,
          oy = pt.originY ?? centY;
        const dx = pt.x - ox,
          dy = pt.y - oy;
        const len = Math.hypot(dx, dy);
        outDx = len > 0 ? dx / len : 0;
        outDy = len > 0 ? dy / len : 1;
      }
      const posStr =
        normPos(
          (Math.abs(outDy) > Math.abs(outDx) * 0.4
            ? outDy > 0
              ? "top"
              : "bottom"
            : "") +
            (Math.abs(outDy) > Math.abs(outDx) * 0.4 &&
            Math.abs(outDx) > Math.abs(outDy) * 0.4
              ? " "
              : "") +
            (Math.abs(outDx) > Math.abs(outDy) * 0.4
              ? outDx > 0
                ? "right"
                : "left"
              : ""),
        ) || "above";
      lines.push(
        `\\node[${posStr}, scale=1.5] at (${f(pt.x)},${f(pt.y)}) {$${text ?? defaultLabelText(spec)}$};`,
      );
    }
  }

  // Angle labels: placed just past the arc radius (same adaptive radius as the arc mark).
  const arcPaddingShort = 0.34;
  const arcPaddingLong = 0.28;
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

    const displayText = text ?? String(++angleDefaultCounter);
    const textLen = displayText.length;

    const sinHalf = Math.max(
      Math.sin(Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y))) / 2),
      0.05,
    );
    // Arc radius mirrors the mark: adapts to angle sharpness just like the drawn arc.
    const SIN_45_HALF = Math.sin((22.5 * Math.PI) / 180);
    const adaptedArcBase = arcBase * Math.max(1, SIN_45_HALF / sinHalf);

    const vertLabel = spec.startsWith("angle ") ? spec.slice(6) : splitPointNames(spec)[1];
    const matchMark = resolvedMarks.find(
      (m) =>
        m.type === "angle" &&
        !m.isRight &&
        (m.spec.startsWith("angle ") ? m.spec.slice(6) : splitPointNames(m.spec)[1]) ===
          vertLabel,
    );
    // Outer edge of the arc (real mark if present, else treat as 1-arc baseline).
    const na = matchMark ? matchMark.arcs : 1;
    const outerR =
      na === 1
        ? adaptedArcBase * 1.3
        : na <= 3
          ? adaptedArcBase * 0.9 + (na - 1) * arcGap * 0.7
          : adaptedArcBase * 1.1 + (na - 1) * arcGap;
    const arcPaddingBase = textLen <= 2 ? arcPaddingShort : arcPaddingLong;
    const arcPadding = arcPaddingBase * Math.max(1.5, adaptedArcBase / arcBase);
    const cosAngle = u1x * u2x + u1y * u2y;
    const angleDeg =
      (Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180) / Math.PI;
    const bigAngleFactor = angleDeg > 80 ? 0.82 : 1.0;
    const offset = (outerR + arcPadding) * bigAngleFactor;

    const fontScale = Math.max(1.2, 1.5 - (textLen - 1) * 0.07);
    const lx = vx + offset * bisX;
    const ly = vy + offset * bisY;
    lines.push(
      `\\node[scale=${f(fontScale)}] at (${f(lx)},${f(ly)}) {$${displayText}$};`,
    );
  }

  // Side labels: placed at midpoint offset outward from centroid.
  if (sideLabelCmds.length > 0) {
    const offsetBySize = { small: 0.28, medium: 0.35, large: 0.54 };
    const offset = offsetBySize[size];
    lines.push("");
    for (const {
      sideSpec,
      labelText,
      labelSide,
      labelOrient,
    } of sideLabelCmds) {
      let p1, p2, defaultLabel, refPt;
      const sideNames = splitPointNames(sideSpec);
      if (sideNames.length === 2) {
        p1 = lookupPt(sideNames[0]);
        p2 = lookupPt(sideNames[1]);
        if (!p1 || !p2) continue;
        const i1 = labels.findIndex((v) => v.label === sideNames[0]);
        const i2 = labels.findIndex((v) => v.label === sideNames[1]);
        if (i1 !== -1 && i2 !== -1) {
          const i3 = [0, 1, 2].find((i) => i !== i1 && i !== i2);
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
      const textLen = text.length;
      let rotateDeg = 0;
      const useAligned = labelOrient ? labelOrient === "aligned" : textLen > 3;
      if (useAligned) {
        rotateDeg = (Math.atan2(sdy, sdx) * 180) / Math.PI;
        if (rotateDeg > 90) rotateDeg -= 180;
        else if (rotateDeg < -90) rotateDeg += 180;
      }
      // Short horizontal labels: center-aligned close to the line.
      // Long horizontal labels: anchor-based so text extends away from the segment.
      let effectiveOffset,
        anchorAttr = "";
      if (rotateDeg !== 0) {
        effectiveOffset = offset;
      } else if (textLen <= 2) {
        effectiveOffset = offset * 0.75;
      } else {
        effectiveOffset = offset * 0.15;
        const adx = sign * px,
          ady = sign * py;
        const ax = Math.abs(adx),
          ay = Math.abs(ady);
        const v = ay > ax * 0.4 ? (ady > 0 ? "south" : "north") : "";
        const h = ax > ay * 0.4 ? (adx > 0 ? "west" : "east") : "";
        const anchor = v + (v && h ? " " : "") + h || "center";
        anchorAttr = `, anchor=${anchor}`;
      }
      const lx = mx + effectiveOffset * sign * px;
      const ly = my + effectiveOffset * sign * py;
      const rotateAttr = rotateDeg !== 0 ? `, rotate=${f(rotateDeg)}` : "";
      lines.push(
        `\\node[scale=1.5${rotateAttr}${anchorAttr}] at (${f(lx)},${f(ly)}) {$${text}$};`,
      );
    }
  }

  // Arc labels: placed outside the circle at the arc midpoint.
  if (arcLabelCmds.length > 0) {
    lines.push("");
    for (const { circleName, arcPts, bigger, text } of arcLabelCmds) {
      const circleCmd = circleCmds.find((c) => c.name === circleName);
      if (!circleCmd) continue;
      const ctr = lookupPt(circleCmd.center);
      if (!ctr) continue;
      const npPt = circleCmd.northPt ? lookupPt(circleCmd.northPt) : null;
      const R = npPt ? Math.hypot(npPt.x - ctr.x, npPt.y - ctr.y) : circleR;
      const pA = lookupPt(arcPts[0]);
      const pB = lookupPt(arcPts[1]);
      if (!pA || !pB) continue;
      const angA = Math.atan2(pA.y - ctr.y, pA.x - ctr.x);
      let angB = Math.atan2(pB.y - ctr.y, pB.x - ctr.x);
      // Normalise angB to [angA, angA+2π)
      while (angB < angA) angB += 2 * Math.PI;
      const sweep = angB - angA; // CCW sweep from A to B (0..2π)
      // smaller arc midpoint = angA + sweep/2; bigger = opposite side
      let midAng = angA + sweep / 2;
      if (bigger) midAng += Math.PI;
      const labelR = R + ptLblOff * 0.5;
      const lx = ctr.x + labelR * Math.cos(midAng);
      const ly = ctr.y + labelR * Math.sin(midAng);
      const anchor = dirToAnchor(Math.cos(midAng), Math.sin(midAng));
      const displayText = text ?? "";
      lines.push(
        `\\node[scale=1.5, anchor=${anchor}] at (${f(lx)},${f(ly)}) {$${displayText}$};`,
      );
    }
  }

  // Mark commands.
  if (resolvedMarks.length > 0) {
    const dotR = 0.09;
    const tickHalf = 0.15;
    const tickGap = 0.12;
    // arcBase / arcGap defined above.
    // Assign radial offsets to angle marks sharing the same vertex+arcCount.
    const _arcVertCount = new Map();
    for (const cmd of resolvedMarks) {
      if (cmd.type !== "angle" || cmd.isRight) continue;
      const vl = cmd.spec.startsWith("angle ")
        ? cmd.spec.slice(6)
        : splitPointNames(cmd.spec)[1];
      const key = `${vl}:${cmd.arcs ?? 0}`;
      const idx = _arcVertCount.get(key) ?? 0;
      cmd._radialOff = idx * 0.14;
      _arcVertCount.set(key, idx + 1);
    }
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
        const specPts = splitPointNames(cmd.spec);
        if (specPts.length === 2) {
          p1 = lookupPt(specPts[0]);
          p2 = lookupPt(specPts[1]);
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
          ty = sdy / slen;
        const px = -ty,
          py = tx;
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
          const SIN_45_HALF = Math.sin((22.5 * Math.PI) / 180);
          const adaptedArcBase = arcBase * Math.max(1, SIN_45_HALF / sinHalfM);
          let sa = (Math.atan2(a1y - vy, a1x - vx) * 180) / Math.PI;
          let ea = (Math.atan2(a2y - vy, a2x - vx) * 180) / Math.PI;
          const cross = (a1x - vx) * (a2y - vy) - (a1y - vy) * (a2x - vx);
          if (cross < 0) {
            [sa, ea] = [ea, sa];
          }
          while (ea <= sa) ea += 360;
          for (let arc = 0; arc < n; arc++) {
            const r =
              (n === 1
                ? adaptedArcBase * 1.3
                : n <= 3
                  ? adaptedArcBase * 0.9 + arc * arcGap * 0.7
                  : adaptedArcBase * 1.1 + arc * arcGap) + cmd._radialOff;
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

  // Distance (perpendicular foot) segments.
  if (distanceCmds.length > 0) {
    lines.push("");
    for (const { fromPt, newName } of distanceCmds) {
      const C = lookupPt(fromPt);
      const K = lookupPt(newName);
      if (C && K) {
        lines.push(
          `\\draw[line width=1pt] (${f(C.x)},${f(C.y)}) -- (${f(K.x)},${f(K.y)});`,
        );
      }
    }
  }

  // Area labels: rendered last so they sit on top of fills and strokes.
  for (const { pts, label } of areaFillCmds) {
    if (!label) continue;
    const n = pts.length;
    const dirs = resolveAreaArcDirs(pts);
    // Build a sampled polygon: arcs are subdivided so the centroid formula accounts for the curved boundary.
    const poly = [];
    for (let i = 0; i < n; i++) {
      const curr = lookupPt(pts[i]);
      const next = lookupPt(pts[(i + 1) % n]);
      if (!curr) continue;
      poly.push(curr);
      if (!next) continue;
      const na = pts[i],
        nb = pts[(i + 1) % n];
      const hasExplicit = drawCmds.some(
        (d) =>
          (d.drawType === "segment" ||
            d.drawType === "line" ||
            d.drawType === "ray") &&
          ((d.pts[0] === na && d.pts[1] === nb) ||
            (d.pts[0] === nb && d.pts[1] === na)),
      );
      const isArcEdge =
        !hasExplicit &&
        curr.originX !== undefined &&
        next.originX !== undefined &&
        Math.abs(curr.originX - next.originX) < 1e-6 &&
        Math.abs(curr.originY - next.originY) < 1e-6;
      if (isArcEdge) {
        const {
          angA,
          angB,
          cx: ocx,
          cy: ocy,
          R,
        } = arcAngles(curr, next, dirs[i]);
        const angAR = (angA * Math.PI) / 180,
          angBR = (angB * Math.PI) / 180;
        for (let s = 1; s <= 7; s++) {
          const ang = angAR + (s / 8) * (angBR - angAR);
          poly.push({ x: ocx + R * Math.cos(ang), y: ocy + R * Math.sin(ang) });
        }
      }
    }
    if (poly.length < 3) continue;
    // Polygon centroid formula (signed area weighted).
    let area = 0,
      cx = 0,
      cy = 0;
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const cross = poly[i].x * poly[j].y - poly[j].x * poly[i].y;
      area += cross;
      cx += (poly[i].x + poly[j].x) * cross;
      cy += (poly[i].y + poly[j].y) * cross;
    }
    area /= 2;
    if (Math.abs(area) < 1e-10) continue;
    cx /= 6 * area;
    cy /= 6 * area;
    lines.push(`\\node[scale=1.5] at (${f(cx)},${f(cy)}) {$${label}$};`);
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
