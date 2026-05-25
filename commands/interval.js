function extractLeftLabels(content) {
  let rest = content.trimStart();
  let topLabel = null;
  let bottomLabel = null;

  // Read a balanced-brace label starting with prefix + "{...}"
  function readBracedLabel(str, prefix) {
    if (!str.startsWith(prefix + "{")) return null;
    let i = prefix.length + 1; // position after the opening "{"
    let depth = 1;
    while (i < str.length) {
      if (str[i] === "{") depth++;
      else if (str[i] === "}") { depth--; if (depth === 0) { i++; break; } }
      i++;
    }
    if (depth !== 0) return null; // unbalanced
    const label = str.slice(prefix.length + 1, i - 1);
    while (i < str.length && /\s/.test(str[i])) i++; // skip trailing whitespace
    return { label, rest: str.slice(i) };
  }

  for (let iter = 0; iter < 2; iter++) {
    const top = topLabel    === null ? readBracedLabel(rest, "^") : null;
    const bot = bottomLabel === null ? readBracedLabel(rest, "_") : null;
    if      (top) { topLabel    = top.label; rest = top.rest; }
    else if (bot) { bottomLabel = bot.label; rest = bot.rest; }
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

// Insert newlines before bare "arcs"/"parabola" keywords that appear on the same
// line as "inline", so the line-splitter treats them as separate sub-commands.
// "bare" means not inside {…}, […], (…), |…|, _…_, =…=  (or ^{…} / _{…} left labels).
function insertKeywordNewlines(content) {
  let out = "";
  let i = 0;
  let curly = 0;
  let inBracket = false, inParen = false, inPipe = false, inSign = false, inHatch = false;

  const atTop = () =>
    curly === 0 && !inBracket && !inParen && !inPipe && !inSign && !inHatch;

  while (i < content.length) {
    const ch = content[i];

    if (atTop()) {
      if (ch === "{") {
        curly++; out += ch; i++;
      } else if ((ch === "^" || ch === "_") && content[i + 1] === "{") {
        // ^{…} or _{…} left-label — track as curly, not as sign token
        curly++;
        out += ch + "{";
        i += 2;
      } else if (ch === "_") {
        inSign = true; out += ch; i++;
      } else if (ch === "[") {
        inBracket = true; out += ch; i++;
      } else if (ch === "(") {
        inParen = true; out += ch; i++;
      } else if (ch === "|") {
        inPipe = true; out += ch; i++;
      } else if (ch === "=") {
        inHatch = true; out += ch; i++;
      } else if (/[ \t]/.test(ch)) {
        // Skip all horizontal whitespace, then check for a keyword
        let j = i;
        while (j < content.length && /[ \t]/.test(content[j])) j++;
        const ahead = content.slice(j);
        if (/^(arcs|parabola|hatch)(?=\s|--|$)/.test(ahead)) {
          out += "\n"; // replace whitespace with newline before keyword
          i = j;      // position cursor at keyword (whitespace already consumed)
        } else {
          out += ch; i++;
        }
      } else {
        out += ch; i++;
      }
    } else {
      // Inside a delimiter — just track closes, no keyword detection
      if      (curly > 0 && ch === "{") curly++;
      else if (curly > 0 && ch === "}") curly--;
      else if (inBracket && ch === "]") inBracket = false;
      else if (inParen   && ch === ")") inParen   = false;
      else if (inPipe    && ch === "|") inPipe    = false;
      else if (inSign    && ch === "_") inSign    = false;
      else if (inHatch   && ch === "=") inHatch   = false;
      out += ch; i++;
    }
  }

  return out;
}

// Parse the multi-line block content (everything after "interval:")
function parseBlock(content) {
  const lines = insertKeywordNewlines(content)
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => l !== "");

  let inlineContent = null;
  let arcsEnabled = false;
  let noLeft = false, noRight = false;
  const arcRanges = [];   // {from: ref|null, to: ref|null}[]  — range-mode arcs
  const hatchRanges = []; // {from: ref|null, to: ref|null, direction: string}[]
  const parabolaLines = [];
  const errors = [];

  // Default hatch direction cycles: 1st→top right, 2nd→bottom right, 3rd→top left, 4th→bottom left
  const HATCH_DEFAULTS = ["top right", "bottom right", "top left", "bottom left"];
  let hatchCommandIdx = 0;

  for (const line of lines) {
    if (/^inline(\s|$)/.test(line)) {
      if (inlineContent !== null) {
        errors.push("Duplicate 'inline' command");
        continue;
      }
      inlineContent = line.slice("inline".length).trimStart();

    } else if (/^arcs(\s|$)/.test(line)) {
      arcsEnabled = true;
      const arg = line.slice("arcs".length).trimStart();
      if (!arg || arg.startsWith("--")) {
        // Old-style: bare or with flag
        const flagMatch = arg.match(/^--\s*(\S+)/);
        if (flagMatch) {
          const flag = flagMatch[1];
          if      (flag === "closed-only") { noLeft = true; noRight = true; }
          else if (flag === "no-left")     { noLeft = true; }
          else if (flag === "no-right")    { noRight = true; }
          else if (flag === "all")         { /* defaults */ }
          else errors.push(`Unknown arcs flag: "${flag}". Use -- closed-only, -- no-left, -- no-right, or -- all`);
        }
        // bare "arcs" → both end arcs (noLeft=false, noRight=false)
      } else {
        // New-style: range spec like "<1>-<2>" or "-<1>-<2>-"
        const ranges = parseRangeStr(arg);
        if (ranges.length === 0) {
          errors.push(`Invalid arcs range: "${arg}"`);
        } else {
          arcRanges.push(...ranges);
        }
      }

    } else if (/^hatch(\s|$)/.test(line)) {
      const rest = line.slice("hatch".length).trimStart();
      // Strip optional " -- top/bottom left/right" direction flag
      const dirMatch = rest.match(/^(.*?)\s*--\s*(top|bottom)\s+(left|right)\s*$/);
      let rangeStr, direction;
      if (dirMatch) {
        rangeStr  = dirMatch[1].trim();
        direction = `${dirMatch[2]} ${dirMatch[3]}`;
      } else {
        rangeStr  = rest;
        direction = HATCH_DEFAULTS[hatchCommandIdx % 4]; // auto-cycle
      }
      hatchCommandIdx++;
      if (!rangeStr) {
        errors.push('hatch requires a range, e.g. "hatch -<1>"');
      } else {
        const ranges = parseRangeStr(rangeStr);
        if (ranges.length === 0) {
          errors.push(`Invalid hatch range: "${rangeStr}"`);
        } else {
          hatchRanges.push(...ranges.map((r) => ({ ...r, direction })));
        }
      }

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

  const noArcs = !arcsEnabled;

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

  return { inlineContent, noLeft, noRight, noArcs, arcRanges, hatchRanges, parabolaSegments, errors };
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

// Parse a range string like "-<1>-<2>-" into [{from, to}] pairs.
// Each part separated by "-" (not inside "<>"). Empty part = infinity end.
function parseRangeStr(str) {
  const parts = [];
  let cur = "";
  let inAngle = false;
  for (const ch of str) {
    if      (ch === "<") { inAngle = true;  cur += ch; }
    else if (ch === ">") { inAngle = false; cur += ch; }
    else if (ch === "-" && !inAngle) { parts.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  parts.push(cur.trim());

  const ranges = [];
  for (let i = 0; i + 1 < parts.length; i++) {
    ranges.push({
      from: parts[i]     === "" ? null : parts[i],
      to:   parts[i + 1] === "" ? null : parts[i + 1],
    });
  }
  return ranges;
}

function syntaxCheck(content) {
  const {
    inlineContent,
    arcRanges,
    hatchRanges,
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

    // Validate arc ranges
    for (const r of arcRanges) {
      if (r.from !== null) {
        if (resolvePointRef(r.from, points) === -1)
          errors.push(`arcs: cannot resolve point "${r.from}"`);
      }
      if (r.to !== null) {
        if (resolvePointRef(r.to, points) === -1)
          errors.push(`arcs: cannot resolve point "${r.to}"`);
      }
    }

    // Validate hatch ranges
    for (const r of hatchRanges) {
      if (r.from !== null) {
        if (resolvePointRef(r.from, points) === -1)
          errors.push(`hatch: cannot resolve point "${r.from}"`);
      }
      if (r.to !== null) {
        if (resolvePointRef(r.to, points) === -1)
          errors.push(`hatch: cannot resolve point "${r.to}"`);
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
    arcRanges,
    hatchRanges,
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
  const numSegments = points.length + 1;

  // Helper: resolve a point ref to a 0-based segment index.
  // from=null → seg 0; to=null → seg numSegments-1.
  function refToFromSeg(ref) {
    if (ref === null) return 0;
    const i = resolvePointRef(ref, points);
    return i === -1 ? null : i + 1;
  }
  function refToToSeg(ref) {
    if (ref === null) return numSegments - 1;
    const i = resolvePointRef(ref, points);
    return i === -1 ? null : i;
  }

  const hatchSegments = [];
  let inHatch = false;
  let prevX = axisStart;
  for (const tok of tokens) {
    if (tok.type === "hatch") {
      inHatch = true;
    } else if (tok.type === "point" || tok.type === "mark") {
      if (inHatch) {
        hatchSegments.push({ from: prevX, to: tok.x }); // direction defaults to "top right"
        inHatch = false;
      }
      prevX = tok.x;
    }
  }
  if (inHatch) hatchSegments.push({ from: prevX, to: axisEnd });

  // Add hatch segments from hatch sub-commands
  for (const r of hatchRanges) {
    const fromSegIdx = refToFromSeg(r.from);
    const toSegIdx   = refToToSeg(r.to);
    if (fromSegIdx === null || toSegIdx === null || fromSegIdx > toSegIdx) continue;
    const fromX = fromSegIdx === 0              ? axisStart             : points[fromSegIdx - 1].x;
    const toX   = toSegIdx   === numSegments - 1 ? axisEnd              : points[toSegIdx].x;
    hatchSegments.push({ from: fromX, to: toX, direction: r.direction });
  }

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
      const span = spanFrom ?? spanTo;
      const isAdjacent = span && span.toIdx - span.fromIdx === 1;
      if (isAdjacent) {
        ptLabelY = -0.4;
        if (span.dir === "up") {
          if (spanFrom) ptLabelX = p.x - 0.3;
          if (spanTo) ptLabelX = p.x + 0.3;
        }
      }
    }
    lines.push(
      `\\node[below, scale=1.5] at (${ptLabelX},${ptLabelY}) {$${p.label}$};`,
    );
  });

  lines.push(`% Signs`);
  for (let i = 0; i < numSegments; i++) {
    const sign = orderedSegments[i]?.label ?? "";
    const isFirst = i === 0;
    const isLast = i === numSegments - 1;
    let fromX, toX;
    if (isFirst)     { fromX = axisStart; toX = points[0].x; }
    else if (isLast) { fromX = lastPointX; toX = axisEnd; }
    else             { fromX = points[i - 1].x; toX = points[i].x; }
    const signX = isFirst ? axisStart + 0.3 : isLast ? axisEnd - 0.3 : (fromX + toX) / 2;
    if (sign)
      lines.push(`\\node[above, scale=1.5] at (${signX},0) {$${sign}$};`);
  }

  lines.push(`% Arcs`);
  if (!noArcs) {
    if (arcRanges.length > 0) {
      // Range mode — one spanning arc per declared range.
      // from=null → left open end (quarter-arc); to=null → right open end (quarter-arc).
      // Both present → full semicircle from fromX to toX (x radius scales with span).
      for (const r of arcRanges) {
        const fromSeg = refToFromSeg(r.from);
        const toSeg   = refToToSeg(r.to);
        if (fromSeg === null || toSeg === null || fromSeg > toSeg) continue;

        if (r.from === null) {
          // Left quarter-arc: ends at the first (to) point
          const toX = points[toSeg].x;
          lines.push(
            `\\draw[thick] (${toX},0) arc[start angle=0, end angle=90, x radius=${xRadius}, y radius=${arcH}];`,
          );
        } else if (r.to === null) {
          // Right quarter-arc: starts at the last (from) point
          const fromX = points[fromSeg - 1].x;
          lines.push(
            `\\draw[thick] (${fromX},0) arc[start angle=180, end angle=90, x radius=${xRadius}, y radius=${arcH}];`,
          );
        } else {
          // Full semicircle spanning from one point to another (possibly non-adjacent)
          const fromX = points[fromSeg - 1].x;
          const toX   = points[toSeg].x;
          const arcXR = (toX - fromX) / 2;
          lines.push(
            `\\draw[thick] (${fromX},0) arc[start angle=180, end angle=0, x radius=${arcXR}, y radius=${arcH}];`,
          );
        }
      }
    } else {
      // Old mode — individual arc per segment, with parabola suppression + noLeft/noRight flags.
      for (let i = 0; i < numSegments; i++) {
        const isFirst = i === 0;
        const isLast  = i === numSegments - 1;
        let fromX, toX;
        if (isFirst)     { fromX = axisStart; toX = points[0].x; }
        else if (isLast) { fromX = lastPointX; toX = axisEnd; }
        else             { fromX = points[i - 1].x; toX = points[i].x; }

        const inParabola =
          !isFirst && !isLast &&
          parabolaSpans.some((ps) => i > ps.fromIdx && i <= ps.toIdx);

        if (inParabola) continue;

        if (!isFirst && !isLast) {
          lines.push(
            `\\draw[thick] (${fromX},0) arc[start angle=180, end angle=0, x radius=${xRadius}, y radius=${arcH}];`,
          );
        } else if (isFirst && !noLeft) {
          lines.push(
            `\\draw[thick] (${toX},0) arc[start angle=0, end angle=90, x radius=${xRadius}, y radius=${arcH}];`,
          );
        } else if (isLast && !noRight) {
          lines.push(
            `\\draw[thick] (${fromX},0) arc[start angle=180, end angle=90, x radius=${xRadius}, y radius=${arcH}];`,
          );
        }
      }
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
  const ext = (step + 0.05).toFixed(2);
  hatchSegments.forEach((seg) => {
    const dir = seg.direction ?? "top right";
    const [vert, horiz] = dir.split(" ");
    const dy = vert  === "top"   ? ext : `-${ext}`;
    const dx = horiz === "right" ? ext : `-${ext}`;
    lines.push(
      `\\foreach \\x in {${seg.from},${(seg.from + step).toFixed(2)},...,${seg.to}} {`,
    );
    lines.push(`    \\draw[line width=1pt] (\\x,0) -- (\\x+${dx},${dy});`);
    lines.push(`}`);
  });

  return `\\begin{document}\n\n\\begin{tikzpicture}\n${lines.join("\n")}\n\\end{tikzpicture}\n\n\\end{document}`;
}

export default [{ prefix: "interval:", syntaxCheck, compile }];
