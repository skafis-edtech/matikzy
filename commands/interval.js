function extractLeftLabels(content) {
  let rest = content.trimStart();
  let topLabel = null;
  let bottomLabel = null;

  for (let i = 0; i < 2; i++) {
    const top = rest.match(/^\^{([^}]*)}\s*/);
    const bot = rest.match(/^_{([^}]*)}\s*/);
    if (top && topLabel === null) {
      topLabel = top[1];
      rest = rest.slice(top[0].length);
    } else if (bot && bottomLabel === null) {
      bottomLabel = bot[1];
      rest = rest.slice(bot[0].length);
    } else break;
  }

  return { topLabel, bottomLabel, rest };
}

function parseIntervalArcsTokens(content) {
  const tokens = [];
  const parseErrors = [];
  let i = 0;

  function skipWS() {
    while (i < content.length && /\s/.test(content[i])) i++;
  }

  function readBalanced(open, close) {
    let depth = 1;
    const start = i;
    while (i < content.length) {
      if (content[i] === open) depth++;
      else if (content[i] === close) {
        depth--;
        if (depth === 0) {
          i++;
          return content.slice(start, i - 1);
        }
      }
      i++;
    }
    return content.slice(start);
  }

  function readUntil(close) {
    const start = i;
    while (i < content.length && content[i] !== close) i++;
    const result = content.slice(start, i);
    i++;
    return result;
  }

  function tryDirection() {
    const m = content.slice(i).match(/^(down|up)/);
    if (m) {
      i += m[1].length;
      return m[1];
    }
    return null;
  }

  while (i < content.length) {
    skipWS();
    if (i >= content.length) break;
    const ch = content[i++];

    if (ch === "[") {
      const label = readBalanced("[", "]");
      skipWS();
      let arrowLabel = null;
      if (i < content.length && content[i] === "{") {
        i++;
        arrowLabel = readBalanced("{", "}");
      }
      tokens.push({ type: "point", dot: "solid", label, arrowLabel });
    } else if (ch === "(") {
      const label = readBalanced("(", ")");
      skipWS();
      let arrowLabel = null;
      if (i < content.length && content[i] === "{") {
        i++;
        arrowLabel = readBalanced("{", "}");
      }
      tokens.push({ type: "point", dot: "hollow", label, arrowLabel });
    } else if (ch === "|") {
      const label = readUntil("|");
      skipWS();
      let arrowLabel = null;
      if (i < content.length && content[i] === "{") {
        i++;
        arrowLabel = readBalanced("{", "}");
      }
      tokens.push({ type: "mark", label, arrowLabel });
    } else if (ch === "=") {
      const label = readUntil("=");
      tokens.push({ type: "hatch", label, direction: tryDirection() });
    } else if (ch === "_") {
      const label = readUntil("_");
      tokens.push({ type: "sign", label, direction: tryDirection() });
    } else if (ch === ">") {
      const start = i;
      while (i < content.length && !/\s/.test(content[i])) i++;
      tokens.push({ type: "arrow", label: content.slice(start, i) });
    } else {
      const start = i - 1;
      while (i < content.length && !/[\s\[(|=_>]/.test(content[i])) i++;
      const gap = content.slice(start, i).trim();
      if (gap) parseErrors.push(`Unrecognized syntax: "${gap}"`);
    }
  }

  return { tokens, parseErrors };
}

// Parse the multi-line block content (everything after "interval:\n")
function parseBlock(content) {
  const lines = content
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => l !== "");

  let inlineContent = null;
  let arcsLine = null;
  const parabolaLines = [];
  const errors = [];

  for (const line of lines) {
    if (/^inline(\s|$)/.test(line)) {
      if (inlineContent !== null) {
        errors.push("Duplicate 'inline' command");
        continue;
      }
      inlineContent = line.slice("inline".length).trimStart();
    } else if (/^arcs(\s|$)/.test(line)) {
      if (arcsLine !== null) {
        errors.push("Duplicate 'arcs' command");
        continue;
      }
      arcsLine = line;
    } else if (/^parabola(\s|$)/.test(line)) {
      parabolaLines.push(line);
    } else {
      errors.push(`Unknown command: "${line}"`);
    }
  }

  if (inlineContent === null) {
    errors.push("Missing 'inline' command");
    inlineContent = "";
  }

  // Parse arcs options — absent means no arcs at all
  let noLeft = false,
    noRight = false,
    noArcs = true;
  if (arcsLine !== null) {
    noArcs = false;
    const flagMatch = arcsLine.match(/--\s*(\S+)/);
    if (flagMatch) {
      const flag = flagMatch[1];
      if (flag === "closed-only") {
        noLeft = true;
        noRight = true;
      } else if (flag === "no-left") {
        noLeft = true;
        noRight = false;
      } else if (flag === "no-right") {
        noLeft = false;
        noRight = true;
      } else if (flag === "all") {
        /* defaults already false */
      } else
        errors.push(
          `Unknown arcs flag: "${flag}". Use -- closed-only, -- no-left, -- no-right, or -- all`,
        );
    }
    // bare "arcs" → both end arcs (noLeft=false, noRight=false)
  }

  // Parse parabola commands
  const parabolaSegments = [];
  for (const line of parabolaLines) {
    const mDir = line.match(/^parabola(?:\s+--\s+(up|down))?$/);
    const mFull = line.match(
      /^parabola\s+(\S+)\s+(\S+)(?:\s+--\s+(up|down))?$/,
    );
    if (mDir) {
      // No point names — default to first two points (resolved at compile/check time)
      parabolaSegments.push({ from: null, to: null, dir: mDir[1] ?? "up" });
    } else if (mFull) {
      parabolaSegments.push({
        from: mFull[1],
        to: mFull[2],
        dir: mFull[3] ?? "up",
      });
    } else {
      errors.push(
        `Invalid parabola syntax: "${line}". Expected: parabola [<p1> <p2>] [-- up|down]`,
      );
    }
  }

  return { inlineContent, noLeft, noRight, noArcs, parabolaSegments, errors };
}

// Resolve a point reference: "<N>" = 1-based index, otherwise match by label.
function resolvePointRef(ref, points) {
  const m = ref.match(/^<(\d+)>$/);
  if (m) {
    const idx = parseInt(m[1], 10) - 1;
    return idx >= 0 && idx < points.length ? idx : -1;
  }
  return points.findIndex((p) => p.label === ref);
}

function syntaxCheck(content) {
  const {
    inlineContent,
    parabolaSegments,
    errors: blockErrors,
  } = parseBlock(content);
  const errors = [...blockErrors];

  if (inlineContent !== "") {
    const { rest } = extractLeftLabels(inlineContent);
    const { tokens, parseErrors } = parseIntervalArcsTokens(rest);
    errors.push(...parseErrors);

    const points = tokens.filter(
      (t) => t.type === "point" || t.type === "mark",
    );
    const signs = tokens.filter((t) => t.type === "sign");
    const hatches = tokens.filter((t) => t.type === "hatch");
    const arrows = tokens.filter((t) => t.type === "arrow");

    if (points.length === 0)
      errors.push("Must have at least one point defined with [n], (n), or |n|");
    if (arrows.length > 1) errors.push("Only one >x allowed");
    if (arrows.length === 1 && tokens[tokens.length - 1].type !== "arrow")
      errors.push(">x must be the last token");

    const numSegments = points.length + 1;
    const numSignTokens = signs.length + hatches.length;
    if (numSignTokens !== numSegments) {
      errors.push(
        `Expected ${numSegments} sign/hatch tokens for ${points.length} point(s), got ${numSignTokens}. ` +
          `Each segment (including before first and after last point) needs either =-= or _+_/_-_`,
      );
    }

    let expectedType = "sign_or_hatch";
    for (const tok of tokens) {
      if (tok.type === "arrow") break;
      if (expectedType === "sign_or_hatch") {
        if (tok.type !== "hatch" && tok.type !== "sign")
          errors.push(
            `Expected =-= or _+_/_-_ before point "${tok.label ?? ""}"`,
          );
        expectedType = "point";
      } else {
        if (tok.type !== "point" && tok.type !== "mark")
          errors.push(
            `Expected a point [n], (n), or |n| after sign/hatch token`,
          );
        expectedType = "sign_or_hatch";
      }
    }

    const lastMeaningful =
      arrows.length === 1
        ? tokens[tokens.length - 2]
        : tokens[tokens.length - 1];
    if (
      lastMeaningful &&
      lastMeaningful.type !== "hatch" &&
      lastMeaningful.type !== "sign"
    )
      errors.push("Missing sign or =-= after last point");

    // Duplicate check for non-empty labels only (empty labels are allowed)
    const nonEmptyLabels = points.map((p) => p.label).filter((l) => l.trim() !== "");
    const duplicates = nonEmptyLabels.filter((l, i) => nonEmptyLabels.indexOf(l) !== i);
    if (duplicates.length > 0)
      errors.push(
        `Duplicate point label(s): ${[...new Set(duplicates)].join(", ")}`,
      );

    // Validate parabola point references (label or <N> index)
    for (const seg of parabolaSegments) {
      if (seg.from === null) {
        if (points.length < 2)
          errors.push(
            `parabola: inline must have at least 2 points when no point names are specified`,
          );
      } else {
        const fromIdx = resolvePointRef(seg.from, points);
        const toIdx   = resolvePointRef(seg.to,   points);
        if (fromIdx === -1)
          errors.push(`parabola: cannot resolve point "${seg.from}"`);
        if (toIdx === -1)
          errors.push(`parabola: cannot resolve point "${seg.to}"`);
        if (fromIdx !== -1 && toIdx !== -1 && toIdx <= fromIdx)
          errors.push(`parabola: "${seg.to}" must come after "${seg.from}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function compile(content) {
  const {
    inlineContent,
    noLeft,
    noRight,
    noArcs,
    parabolaSegments: rawParabolaSegments,
  } = parseBlock(content);

  const { topLabel, bottomLabel, rest } = extractLeftLabels(inlineContent);
  const { tokens } = parseIntervalArcsTokens(rest);

  const SPACING = 2;
  const START_X = -3;
  const xRadius = SPACING / 2;
  const points = tokens.filter((t) => t.type === "point" || t.type === "mark");
  points.forEach((p, i) => {
    p.x = START_X + i * SPACING;
  });

  // Resolve parabola segments: null from/to → first two points; <N> → 0-based index
  const parabolaSpans = rawParabolaSegments
    .map((seg) => {
      let fromIdx, toIdx;
      if (seg.from === null) {
        if (points.length < 2) return null;
        fromIdx = 0;
        toIdx = 1;
      } else {
        fromIdx = resolvePointRef(seg.from, points);
        toIdx   = resolvePointRef(seg.to,   points);
      }
      if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) return null;
      return {
        fromIdx,
        toIdx,
        fromX: points[fromIdx].x,
        toX: points[toIdx].x,
        dir: seg.dir,
      };
    })
    .filter(Boolean);

  const arrowLabel = tokens.find((t) => t.type === "arrow")?.label ?? null;
  const lastPointX = points[points.length - 1].x;
  const axisStart = points[0].x - 1.0;
  const axisEnd = lastPointX + 1.0;

  const hatchSegments = [];
  let inHatch = false;
  let prevX = axisStart;
  for (const tok of tokens) {
    if (tok.type === "hatch") {
      inHatch = true;
    } else if (tok.type === "point" || tok.type === "mark") {
      if (inHatch) {
        hatchSegments.push({ from: prevX, to: tok.x });
        inHatch = false;
      }
      prevX = tok.x;
    }
  }
  if (inHatch) hatchSegments.push({ from: prevX, to: axisEnd });

  const orderedSegments = tokens
    .filter((t) => t.type === "hatch" || t.type === "sign")
    .map((t) => ({ label: t.label, direction: t.direction ?? null }));

  const lines = [];
  const arcH = 0.7;

  lines.push(`% Left labels`);
  const labelX = axisStart - 1;
  if (topLabel !== null)
    lines.push(`\\node[scale=1.2] at (${labelX},0.5) {$${topLabel}$};`);
  if (bottomLabel !== null)
    lines.push(`\\node[scale=1.2] at (${labelX},-0.5) {$${bottomLabel}$};`);

  lines.push(`% Axis`);
  lines.push(`\\draw[line width=1pt] (${axisStart},0) -- (${axisEnd},0);`);
  if (arrowLabel !== null) {
    lines.push(
      `\\fill (${axisEnd},0) -- (${axisEnd - 0.2},0.1) -- (${axisEnd - 0.2},-0.1) -- cycle;`,
    );
    if (arrowLabel !== "")
      lines.push(
        `\\node[below, scale=1.5] at (${axisEnd - 0.1},0) {$${arrowLabel}$};`,
      );
  }

  lines.push(`% Points`);
  points.forEach((p, idx) => {
    if (p.type === "mark") {
      lines.push(`\\draw[line width=1pt] (${p.x},-0.12) -- (${p.x},0.12);`);
    } else {
      lines.push(
        p.dot === "solid"
          ? `\\fill (${p.x},0) circle (3pt);`
          : `\\draw[line width=1.5pt, fill=white] (${p.x},0) circle (3.5pt);`,
      );
    }
    // Adjust label position if this point is within or on the boundary of a parabola span
    const spanFrom = parabolaSpans.find((s) => s.fromIdx === idx);
    const spanTo = parabolaSpans.find((s) => s.toIdx === idx);
    const spanMid =
      !spanFrom &&
      !spanTo &&
      parabolaSpans.some((s) => idx > s.fromIdx && idx < s.toIdx);
    let ptLabelX = p.x;
    let ptLabelY = 0;
    if (spanFrom || spanTo || spanMid) {
      ptLabelY = -0.4;
      const span = spanFrom ?? spanTo;
      if (span?.dir === "up") {
        if (spanFrom) ptLabelX = p.x - 0.3;
        if (spanTo) ptLabelX = p.x + 0.3;
      }
    }
    lines.push(
      `\\node[below, scale=1.5] at (${ptLabelX},${ptLabelY}) {$${p.label}$};`,
    );
  });

  lines.push(`% Arcs and signs`);
  const numSegments = points.length + 1;
  for (let i = 0; i < numSegments; i++) {
    const sign = orderedSegments[i]?.label ?? "";
    const isFirst = i === 0;
    const isLast = i === numSegments - 1;

    let fromX, toX;
    if (isFirst) {
      fromX = axisStart;
      toX = points[0].x;
    } else if (isLast) {
      fromX = lastPointX;
      toX = axisEnd;
    } else {
      fromX = points[i - 1].x;
      toX = points[i].x;
    }

    const signX = isFirst
      ? axisStart + 0.3
      : isLast
        ? axisEnd - 0.3
        : (fromX + toX) / 2;
    if (sign)
      lines.push(`\\node[above, scale=1.5] at (${signX},0) {$${sign}$};`);

    // Suppress arc for intermediate segments that fall inside a parabola span
    const inParabola =
      !isFirst &&
      !isLast &&
      parabolaSpans.some((ps) => i > ps.fromIdx && i <= ps.toIdx);

    if (!isFirst && !isLast && !inParabola && !noArcs) {
      lines.push(
        `\\draw[thick] (${fromX},0) arc[start angle=180, end angle=0, x radius=${xRadius}, y radius=${arcH}];`,
      );
    } else if (isFirst && !noArcs && !noLeft) {
      lines.push(
        `\\draw[thick] (${toX},0) arc[start angle=0, end angle=90, x radius=${xRadius}, y radius=${arcH}];`,
      );
    } else if (isLast && !noArcs && !noRight) {
      lines.push(
        `\\draw[thick] (${fromX},0) arc[start angle=180, end angle=90, x radius=${xRadius}, y radius=${arcH}];`,
      );
    }
  }

  // Draw full parabola arcs (one per span, spanning all covered segments)
  // Keep peak height constant: |a| = 4H/d² where H=1 and d = span width
  lines.push(`% Parabolas`);
  for (const ps of parabolaSpans) {
    const d = ps.toX - ps.fromX;
    const a = ((ps.dir === "up" ? 1 : -1) * 4) / (d * d);
    const legExt = 0.6;
    lines.push(
      `\\draw[thick, smooth, domain=${ps.fromX - legExt}:${ps.toX + legExt}, samples=60] plot (\\x, {${a}*(\\x - ${ps.fromX})*(\\x - ${ps.toX})});`,
    );
  }

  lines.push(`% Arrows below`);
  for (let i = 0; i < numSegments; i++) {
    const direction = orderedSegments[i]?.direction;
    if (!direction) continue;

    const isFirst = i === 0;
    const isLast = i === numSegments - 1;

    let fromX, toX;
    if (isFirst) {
      fromX = axisStart + 0.1;
      toX = points[0].x - 0.1;
    } else if (isLast) {
      fromX = lastPointX + 0.1;
      toX = axisEnd - 0.1;
    } else {
      fromX = points[i - 1].x + 0.6;
      toX = points[i].x - 0.6;
    }

    if (direction === "down") {
      lines.push(`\\draw[line width=1pt] (${fromX},-0.7) -- (${toX},-1.5);`);
      lines.push(
        `\\fill (${toX},-1.5) -- (${toX},-1.3) -- (${toX - 0.2},-1.5) -- cycle;`,
      );
    } else {
      lines.push(`\\draw[line width=1pt] (${fromX},-1.5) -- (${toX},-0.7);`);
      lines.push(
        `\\fill (${toX},-0.7) -- (${toX},-0.9) -- (${toX - 0.2},-0.7) -- cycle;`,
      );
    }
  }

  const pointsWithArrowLabels = points.filter((p) => p.arrowLabel);
  if (pointsWithArrowLabels.length > 0) {
    for (const p of pointsWithArrowLabels)
      lines.push(`\\node[scale=1.5] at (${p.x},-2) {$${p.arrowLabel}$};`);
  }

  lines.push(`% Hatching`);
  const step = 0.15;
  hatchSegments.forEach((seg) => {
    lines.push(
      `\\foreach \\x in {${seg.from},${(seg.from + step).toFixed(2)},...,${seg.to}} {`,
    );
    lines.push(
      `    \\draw[line width=1pt] (\\x,0) -- (\\x+${(step + 0.05).toFixed(2)},${(step + 0.05).toFixed(2)});`,
    );
    lines.push(`}`);
  });

  return `\\begin{document}\n\n\\begin{tikzpicture}\n${lines.join("\n")}\n\\end{tikzpicture}\n\n\\end{document}`;
}

export default [{ prefix: "interval:", syntaxCheck, compile }];
