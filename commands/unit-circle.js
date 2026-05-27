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
// Accepts: pi, -pi, 2pi, -3pi, 1.5pi, 0.5pi, 1/2pi, -3/4pi, 11/6pi, etc.
function parsePiRadians(s) {
  // coefficient can be: empty (=1), integer, decimal, or int/int fraction
  const m = s.match(/^(-?)(\d+(?:\.\d+)?|\d+\/\d+)?pi$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const raw = m[2];
  let coeff;
  if (!raw) {
    coeff = 1;
  } else if (raw.includes("/")) {
    const [num, den] = raw.split("/");
    coeff = parseInt(num) / parseInt(den);
  } else {
    coeff = parseFloat(raw);
  }
  return sign * coeff * Math.PI;
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
const ROTANGLE_RE = /^rotangle\s+([A-Za-z]\w*)-([A-Za-z]\w*)(?:\s+(.+))?$/;
const ANGLE_RE = /^angle\s+([A-Za-z]\w*)-([A-Za-z]\w*)(?:\s+(.+))?$/;
const XLINE_RE = /^x-line\s+([A-Za-z]\w*)(?:\s+(?!--\s)(\S+))?(?:\s+--\s+(dotted|dashed|solid))?(\s+right-angle)?$/;
const YLINE_RE = /^y-line\s+([A-Za-z]\w*)(?:\s+(?!--\s)(\S+))?(?:\s+--\s+(dotted|dashed|solid))?(\s+right-angle)?$/;
const LINE_RE = /^line\s+(x|y)=(-?\d+(?:\.\d+)?)$/;

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
  const lineDraws = [];

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
      labels[m[1]] = {
        text: m[2] ?? m[3] ?? m[4],
        dot:
          m[2] !== undefined ? "filled" : m[3] !== undefined ? "hollow" : null,
      };
    } else if ((m = line.match(ROTANGLE_RE))) {
      rotangles.push({ from: m[1], to: m[2], arcLabel: m[3], arrow: true });
    } else if ((m = line.match(ANGLE_RE))) {
      rotangles.push({ from: m[1], to: m[2], arcLabel: m[3], arrow: false });
    } else if ((m = line.match(XLINE_RE))) {
      xlines.push({ name: m[1], label: m[2] ?? null, style: m[3] ?? "dotted", rightAngle: !!m[4] });
    } else if ((m = line.match(YLINE_RE))) {
      ylines.push({ name: m[1], label: m[2] ?? null, style: m[3] ?? "dotted", rightAngle: !!m[4] });
    } else if ((m = line.match(LINE_RE))) {
      lineDraws.push({ axis: m[1], val: parseFloat(m[2]) });
    } else {
      errors.push(`Unknown command: "${line}"`);
    }
  }

  return { points, labels, rotangles, xlines, ylines, lineDraws, errors };
}

function syntaxCheck(content) {
  const trimmed = content.trim();
  if (trimmed === "") return { valid: true, errors: [] };

  const { points, labels, rotangles, xlines, ylines, lineDraws, errors } =
    parseCommands(trimmed);
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

  const { points, labels, rotangles, xlines, ylines, lineDraws } =
    trimmed !== ""
      ? parseCommands(trimmed)
      : { points: {}, labels: {}, rotangles: [], xlines: [], ylines: [], lineDraws: [] };

  const oInQ3 = rotangles.some(({ to }) => {
    const pt = points[to];
    return pt && pt.x < 0 && pt.y < 0;
  });
  lines.push(
    oInQ3
      ? `\\node[below, scale=1.1] at (0.2,0.05) {$O$};`
      : `\\node[below, scale=1.1] at (-0.2,0) {$O$};`,
  );

  // Radius sequence: 1st=0.6, 2nd=0.45 (smaller), 3rd=0.75 then growing.
  const rotangleRadius = (i) =>
    i === 0 ? 0.6 : i === 1 ? 0.45 : 0.75 + (i - 2) * 0.15;

  for (let ri = 0; ri < rotangles.length; ri++) {
    const { from, to, arcLabel, arrow } = rotangles[ri];
    const fromPt = points[from];
    const toPt = points[to];
    const { x, y, deg: toDeg } = toPt;
    const fromDeg = fromPt.deg;
    const span = toDeg - fromDeg;

    const isSpiral = Math.abs(span) > 360;
    const R_BASE = rotangleRadius(ri);
    const STEP = 0.2; // radius increase per full revolution

    const arcRad = (toDeg * Math.PI) / 180;
    const cosA = Math.cos(arcRad);
    const sinA = Math.sin(arcRad);
    const cw = span < 0;
    const arrowRad = arcRad + ((cw ? 14 : -14) * Math.PI) / 180;
    const cosAr = Math.cos(arrowRad);
    const sinAr = Math.sin(arrowRad);

    const startX = fmt(R_BASE * Math.cos((fromDeg * Math.PI) / 180));
    const startY = fmt(R_BASE * Math.sin((fromDeg * Math.PI) / 180));

    lines.push(``, `% Rotation angle`);

    if (isSpiral) {
      // Phases per revolution:
      //   Phase 1 (0–180°)  : rx=r,      ry=r        — flat semicircle
      //   Phase 2 (180–270°): rx=r,      ry=r+STEP/2  — ry expands
      //   Phase 3 (270–360°): rx=r+STEP, ry=r+STEP/2  — rx expands, r advances
      // The phases apply continuously — even the final partial revolution
      // gets the expanded radii once it enters Q3 or Q4.
      const dir = span > 0 ? 1 : -1;
      let r = R_BASE;
      let absLeft = Math.abs(span);
      let cur = fromDeg;
      let rxEnd = R_BASE,
        ryEnd = R_BASE; // track actual endpoint radii

      const arcPt = (rx, ry, angle) => {
        const rad = (angle * Math.PI) / 180;
        return `(${fmt(rx * Math.cos(rad))},${fmt(ry * Math.sin(rad))})`;
      };

      while (absLeft > 0.001) {
        // Phase 1: flat semicircle (up to 180°)
        const seg1 = Math.min(180, absLeft);
        const e1 = cur + dir * seg1;
        lines.push(
          `\\draw[thick] ${arcPt(r, r, cur)} arc[start angle=${fmt(cur)}, end angle=${fmt(e1)}, x radius=${fmt(r)}, y radius=${fmt(r)}];`,
        );
        cur = e1;
        absLeft -= seg1;
        rxEnd = r;
        ryEnd = r;
        if (absLeft < 0.001) break;

        // Phase 2: ry expands (up to 90°)
        const seg2 = Math.min(90, absLeft);
        const e2 = cur + dir * seg2;
        lines.push(
          `\\draw[thick] ${arcPt(r, r + STEP / 2, cur)} arc[start angle=${fmt(cur)}, end angle=${fmt(e2)}, x radius=${fmt(r)}, y radius=${fmt(r + STEP / 2)}];`,
        );
        cur = e2;
        absLeft -= seg2;
        rxEnd = r;
        ryEnd = r + STEP / 2;
        if (absLeft < 0.001) break;

        // Phase 3: rx expands (up to 90°), then r advances
        const seg3 = Math.min(90, absLeft);
        const e3 = cur + dir * seg3;
        lines.push(
          `\\draw[thick] ${arcPt(r + STEP, r + STEP / 2, cur)} arc[start angle=${fmt(cur)}, end angle=${fmt(e3)}, x radius=${fmt(r + STEP)}, y radius=${fmt(r + STEP / 2)}];`,
        );
        cur = e3;
        absLeft -= seg3;
        rxEnd = r + STEP;
        ryEnd = r + STEP / 2;
        r += STEP;
      }

      const arcX = fmt(rxEnd * cosA);
      const arcY = fmt(ryEnd * sinA);
      if (arrow) {
        const w1x = fmt(rxEnd * cosA + (cw ? -1 : 1) * 0.2 * sinAr + 0.1 * cosAr);
        const w1y = fmt(ryEnd * sinA + (cw ? 1 : -1) * 0.2 * cosAr + 0.1 * sinAr);
        const w2x = fmt(rxEnd * cosA + (cw ? -1 : 1) * 0.2 * sinAr - 0.1 * cosAr);
        const w2y = fmt(ryEnd * sinA + (cw ? 1 : -1) * 0.2 * cosAr - 0.1 * sinAr);
        lines.push(
          `\\fill (${arcX}, ${arcY}) -- (${w1x}, ${w1y}) -- (${w2x}, ${w2y}) -- cycle;`,
        );
      }
    } else {
      const arcX = fmt(R_BASE * cosA);
      const arcY = fmt(R_BASE * sinA);
      lines.push(
        `\\draw[thick] (${startX},${startY}) arc[start angle=${fromDeg}, end angle=${toDeg}, x radius=${fmt(R_BASE)}, y radius=${fmt(R_BASE)}];`,
      );
      if (arrow) {
        const w1x = fmt(R_BASE * cosA + (cw ? -1 : 1) * 0.2 * sinAr + 0.1 * cosAr);
        const w1y = fmt(R_BASE * sinA + (cw ? 1 : -1) * 0.2 * cosAr + 0.1 * sinAr);
        const w2x = fmt(R_BASE * cosA + (cw ? -1 : 1) * 0.2 * sinAr - 0.1 * cosAr);
        const w2y = fmt(R_BASE * sinA + (cw ? 1 : -1) * 0.2 * cosAr - 0.1 * sinAr);
        lines.push(
          `\\fill (${arcX}, ${arcY}) -- (${w1x}, ${w1y}) -- (${w2x}, ${w2y}) -- cycle;`,
        );
      }
    }
    lines.push(
      `\\draw[line width=1pt] (0,0) -- (${fmt(fromPt.x)}, ${fmt(fromPt.y)});`,
    );
    lines.push(`\\draw[line width=1pt] (0,0) -- (${fmt(x)}, ${fmt(y)});`);

    if (arcLabel) {
      const midDeg = (fromDeg + toDeg) / 2;
      let lblDeg;
      if (Math.abs(span) < 90) {
        // Small arc (< 90°): label at the arc midpoint.
        lblDeg = midDeg;
      } else {
        // Larger arc: label at the centre of the 90° quarter that contains the midpoint.
        // Quarter centres: Q1→45°, Q2→135°, Q3→225°, Q4→315°.
        const norm = ((midDeg % 360) + 360) % 360;
        lblDeg = Math.floor(norm / 90) * 90 + 45;
      }
      const lblRad = (lblDeg * Math.PI) / 180;
      const lblCos = Math.cos(lblRad);

      // Label sits just outside the outermost arc of the rotangle/spiral.
      // For a plain arc the outer edge is R_BASE (0.6); for a spiral it grows.
      let outerArcR = R_BASE;
      if (isSpiral) {
        const posInLastRev = Math.abs(span) % 360;
        const revR = R_BASE + Math.floor(Math.abs(span) / 360) * STEP;
        outerArcR =
          posInLastRev > 270
            ? revR + STEP
            : posInLastRev > 180
              ? revR + STEP / 2
              : revR;
      }
      const lblRadius = outerArcR + 0.02;

      const lblX = fmt(lblRadius * lblCos);
      const lblSin = Math.sin(lblRad);
      const lblY = fmt(lblRadius * lblSin + (lblSin >= 0 ? 0.12 : -0.12));
      // Always anchor left (right half) or right (left half) — just a small nudge
      // so long labels don't overlap the arc. Never above/below.
      const lblAlign = lblCos >= 0 ? "right, " : "left, ";
      lines.push(
        `\\node[${lblAlign}scale=1.5] at (${lblX}, ${lblY}) {$${arcLabel}$};`,
      );
    }
  }

  for (const { axis, val } of lineDraws) {
    const v = fmt(val * RADIUS);
    if (axis === "x") {
      lines.push(`\\draw[line width=1pt] (${v}, -3.5) -- (${v}, 3.5);`);
    } else {
      lines.push(`\\draw[line width=1pt] (-3.5, ${v}) -- (3.5, ${v});`);
    }
  }

  for (const { name, label, style, rightAngle } of xlines) {
    const pt = points[name];
    if (!pt) continue;
    const s = style === "solid" ? "line width=1pt" : `${style}, line width=1pt`;
    lines.push(
      `\\draw[${s}] (${fmt(pt.x)}, ${fmt(pt.y)}) -- (${fmt(pt.x)}, 0);`,
    );
    if (rightAngle) {
      const sq = 0.22;
      const raXd = fmt(pt.x + (pt.x >= 0 ? -1 : 1) * sq);
      const raYd = fmt((pt.y >= 0 ? 1 : -1) * sq);
      lines.push(
        `\\draw[line width=0.8pt] (${raXd}, 0) -- (${raXd}, ${raYd}) -- (${fmt(pt.x)}, ${raYd});`,
      );
    }
    if (label) {
      const xAlign = pt.y < 0 ? "above" : "below";
      lines.push(
        `\\node[${xAlign}, scale=1.5] at (${fmt(pt.x)}, 0) {$${label}$};`,
      );
    }
  }
  for (const { name, label, style, rightAngle } of ylines) {
    const pt = points[name];
    if (!pt) continue;
    const s = style === "solid" ? "line width=1pt" : `${style}, line width=1pt`;
    lines.push(
      `\\draw[${s}] (${fmt(pt.x)}, ${fmt(pt.y)}) -- (0, ${fmt(pt.y)});`,
    );
    if (rightAngle) {
      const sq = 0.22;
      const raXd = fmt((pt.x >= 0 ? 1 : -1) * sq);
      const raYd = fmt(pt.y + (pt.y >= 0 ? -1 : 1) * sq);
      lines.push(
        `\\draw[line width=0.8pt] (${raXd}, ${fmt(pt.y)}) -- (${raXd}, ${raYd}) -- (0, ${raYd});`,
      );
    }
    if (label) {
      const yAlign = pt.x < 0 ? "right" : "left";
      lines.push(
        `\\node[${yAlign}, scale=1.5] at (0, ${fmt(pt.y)}) {$${label}$};`,
      );
    }
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
