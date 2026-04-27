function extractLeftLabels(content) {
  let rest = content.trimStart();
  let topLabel = null;
  let bottomLabel = null;

  for (let i = 0; i < 2; i++) {
    const top = rest.match(/^\^{([^}]*)}\s*/);
    const bot = rest.match(/^_{([^}]*)}\s*/);
    if (top && topLabel === null) { topLabel = top[1]; rest = rest.slice(top[0].length); }
    else if (bot && bottomLabel === null) { bottomLabel = bot[1]; rest = rest.slice(bot[0].length); }
    else break;
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
        if (depth === 0) { i++; return content.slice(start, i - 1); }
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
    if (m) { i += m[1].length; return m[1]; }
    return null;
  }

  while (i < content.length) {
    skipWS();
    if (i >= content.length) break;
    const ch = content[i++];

    if (ch === "[") {
      tokens.push({ type: "point", dot: "solid", label: readBalanced("[", "]") });
    } else if (ch === "(") {
      tokens.push({ type: "point", dot: "hollow", label: readBalanced("(", ")") });
    } else if (ch === "|") {
      tokens.push({ type: "mark", label: readUntil("|") });
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

function syntaxCheck(content) {
  const errors = [];

  const { rest } = extractLeftLabels(content);
  const { tokens, parseErrors } = parseIntervalArcsTokens(rest);
  errors.push(...parseErrors);

  const points = tokens.filter((t) => t.type === "point" || t.type === "mark");
  const signs = tokens.filter((t) => t.type === "sign");
  const hatches = tokens.filter((t) => t.type === "hatch");
  const arrows = tokens.filter((t) => t.type === "arrow");

  if (points.length === 0)
    errors.push("Must have at least one point defined with [n], (n), or |n|");
  if (arrows.length > 1) errors.push("Only one >x allowed");
  if (arrows.length === 1 && tokens[tokens.length - 1].type !== "arrow")
    errors.push(">x must be the last token");

  points.forEach((p) => {
    if (p.label.trim() === "")
      errors.push(
        `Empty point label: ${p.type === "mark" ? "|...|" : p.dot === "solid" ? "[...]" : "(...)"}`,
      );
  });

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
        errors.push(`Expected a point [n], (n), or |n| after sign/hatch token`);
      expectedType = "sign_or_hatch";
    }
  }

  const lastMeaningful =
    arrows.length === 1 ? tokens[tokens.length - 2] : tokens[tokens.length - 1];
  if (
    lastMeaningful &&
    lastMeaningful.type !== "hatch" &&
    lastMeaningful.type !== "sign"
  )
    errors.push("Missing sign or =-= after last point");

  const labels = points.map((p) => p.label);
  const duplicates = labels.filter((l, i) => labels.indexOf(l) !== i);
  if (duplicates.length > 0)
    errors.push(
      `Duplicate point label(s): ${[...new Set(duplicates)].join(", ")}`,
    );

  return { valid: errors.length === 0, errors };
}

function compile(content, noLeft = false, noRight = false, noArcs = false) {
  const { topLabel, bottomLabel, rest } = extractLeftLabels(content);
  const { tokens } = parseIntervalArcsTokens(rest);

  const SPACING = 2;
  const START_X = -3;
  const xRadius = SPACING / 2;
  const points = tokens.filter((t) => t.type === "point" || t.type === "mark");
  points.forEach((p, i) => {
    p.x = START_X + i * SPACING;
  });

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
  points.forEach((p) => {
    if (p.type === "mark") {
      lines.push(`\\draw[line width=1pt] (${p.x},-0.12) -- (${p.x},0.12);`);
    } else {
      lines.push(
        p.dot === "solid"
          ? `\\fill (${p.x},0) circle (3pt);`
          : `\\draw[line width=1.5pt, fill=white] (${p.x},0) circle (3.5pt);`,
      );
    }
    lines.push(`\\node[below, scale=1.5] at (${p.x},0) {$${p.label}$};`);
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

    if (!noArcs) {
      if (!isFirst && !isLast)
        lines.push(
          `\\draw[thick] (${fromX},0) arc[start angle=180, end angle=0, x radius=${xRadius}, y radius=${arcH}];`,
        );
      else if (isFirst && !noLeft)
        lines.push(
          `\\draw[thick] (${toX},0) arc[start angle=0, end angle=90, x radius=${xRadius}, y radius=${arcH}];`,
        );
      else if (isLast && !noRight)
        lines.push(
          `\\draw[thick] (${fromX},0) arc[start angle=180, end angle=90, x radius=${xRadius}, y radius=${arcH}];`,
        );
    }
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
      lines.push(`\\fill (${toX},-1.5) -- (${toX},-1.3) -- (${toX - 0.2},-1.5) -- cycle;`);
    } else {
      lines.push(`\\draw[line width=1pt] (${fromX},-1.5) -- (${toX},-0.7);`);
      lines.push(`\\fill (${toX},-0.7) -- (${toX},-0.9) -- (${toX - 0.2},-0.7) -- cycle;`);
    }
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

  return lines.join("\n");
}

export default [
  { prefix: "interval-arcs: ",                syntaxCheck, compile: (c) => compile(c) },
  { prefix: "interval-arcs[no-left]: ",        syntaxCheck, compile: (c) => compile(c, true, false) },
  { prefix: "interval-arcs[no-right]: ",       syntaxCheck, compile: (c) => compile(c, false, true) },
  { prefix: "interval-arcs[no-left][no-right]:", syntaxCheck, compile: (c) => compile(c, true, true) },
  { prefix: "interval-arcs[closed-only]: ",    syntaxCheck, compile: (c) => compile(c, true, true) },
  { prefix: "interval: ",                      syntaxCheck, compile: (c) => compile(c, false, false, true) },
  { prefix: "interval[closed-only]: ",         syntaxCheck, compile: (c) => compile(c, true, true, true) },
];
