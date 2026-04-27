import express from "express";
import crypto from "crypto";
import Redis from "ioredis";
import zlib from "zlib";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { load, tex, dvi2svg } from "node-tikzjax";
import { compile as compileMatikzy } from "./matikzy.js";
await load();

const app = express();
// app.use((req, res, next) => {
//     res.set("Access-Control-Allow-Origin", "*");
//     res.set("Access-Control-Allow-Headers", "Content-Type");
//     res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
//     if (req.method === "OPTIONS") return res.sendStatus(204);
//     next();
// });
app.use(express.json({ limit: "16kb" }));

let redis = null;
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await redis.connect();
  } catch {
    redis = null;
  }
}

const limiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Rate limit exceeded",
  store: redis
    ? new RedisStore({ sendCommand: (...args) => redis.call(...args) })
    : undefined,
});

async function inc(key) {
  if (redis) {
    try {
      await redis.incr("stats:" + key);
    } catch {}
  }
}

app.get("/stats", async (_, res) => {
  if (!redis) return res.status(503).json({ error: "Redis unavailable" });
  try {
    const keys = ["requests", "cache_hits", "renders", "errors", "queue_full"];
    const values = await redis.mget(keys.map((k) => "stats:" + k));
    const stats = Object.fromEntries(
      keys.map((k, i) => [k, Number(values[i] ?? 0)]),
    );
    res.json(stats);
  } catch {
    res.status(500).json({ error: "Failed to read stats" });
  }
});

function hashTikz(tikz) {
  return crypto.createHash("sha256").update(tikz).digest("hex");
}

function normalize(tikz) {
  return tikz
    .replace(/(?<!\\)%[^\n]*/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

app.get("/", (_, res) => res.sendFile("public/demo.html", { root: "." }));
app.get("/matikzy.js", (_, res) => res.sendFile("matikzy.js", { root: "." }));
app.use("/commands", express.static("commands"));

function checkTikzSyntax(code) {
  if (!code.trim()) return "Empty TikZ code";
  if (!code.includes("\\begin{tikzpicture}"))
    return "Missing \\begin{tikzpicture}";
  if (!code.includes("\\end{tikzpicture}")) return "Missing \\end{tikzpicture}";

  let depth = 0;
  for (const ch of code) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth < 0) return "Unmatched }";
  }
  if (depth !== 0) return `Unclosed { (${depth} remaining)`;

  depth = 0;
  for (const ch of code) {
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    if (depth < 0) return "Unmatched ]";
  }
  if (depth !== 0) return `Unclosed [ (${depth} remaining)`;

  const begins = [...code.matchAll(/\\begin\{([^}]+)\}/g)].map((m) => m[1]);
  const ends = [...code.matchAll(/\\end\{([^}]+)\}/g)].map((m) => m[1]);
  for (const env of begins) {
    const idx = ends.indexOf(env);
    if (idx === -1) return `Missing \\end{${env}}`;
    ends.splice(idx, 1);
  }
  if (ends.length > 0) return `Missing \\begin{${ends[0]}}`;

  return null;
}

// node-tikzjax uses shared global WASM state; concurrent calls corrupt it.
// Serialize all tex() calls through a promise chain.
// Bad TeX syntax causes the WASM asyncify loop to spin forever — the promise never
// settles. A timeout detects this and exits so the container can restart cleanly.
const RENDER_TIMEOUT_MS = 20_000;

let renderQueue = Promise.resolve();
let queueDepth = 0;
const MAX_QUEUE = 5;

function withRenderLock(fn) {
  if (queueDepth >= MAX_QUEUE) return Promise.reject(new Error("Queue full"));
  queueDepth++;

  const timedFn = () =>
    new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {
        queueDepth--;
        reject(new Error(`Render timed out after ${RENDER_TIMEOUT_MS}ms`));
        // WASM is stuck; exit so the container restarts with clean state.
        setImmediate(() => process.exit(1));
      }, RENDER_TIMEOUT_MS);

      fn().then(
        (v) => {
          queueDepth--;
          clearTimeout(deadline);
          resolve(v);
        },
        (e) => {
          queueDepth--;
          clearTimeout(deadline);
          reject(e);
        },
      );
    });

  const next = renderQueue.then(timedFn, timedFn);
  renderQueue = next.then(
    () => {},
    () => {},
  );
  return next;
}

app.post("/render", limiter, async (req, res) => {
  const { lang, content } = req.body ?? {};
  if (!lang || !content) {
    res
      .status(400)
      .send('Body must be {"lang": "tikz"|"matikzy", "content": "..."}');
    return;
  }

  let tikzSource;
  if (lang === "matikzy") {
    try {
      tikzSource = compileMatikzy(content);
    } catch (err) {
      res.status(400).send(`Matikzy compile error: ${err.message}`);
      return;
    }
  } else if (lang === "tikz") {
    tikzSource = content;
  } else {
    res.status(400).send(`Unknown lang "${lang}". Use "tikz" or "matikzy".`);
    return;
  }

  const tikz = normalize(tikzSource);
  const syntaxError = checkTikzSyntax(tikz);
  if (syntaxError) {
    res.status(400).send(`Syntax error: ${syntaxError}`);
    return;
  }
  const key = "tikz:" + hashTikz(tikz);
  const start = Date.now();
  const ip = req.ip;
  console.info("[render] received", {
    ip,
    chars: tikz.length,
    key: key.slice(0, 16),
  });
  inc("requests");

  if (redis) {
    try {
      const cached = await redis.getBuffer(key);
      if (cached) {
        inc("cache_hits");
        console.info("[render] cache hit", { ip, ms: Date.now() - start });
        res.type("image/svg+xml").send(zlib.gunzipSync(cached));
        return;
      }
    } catch {
      redis = null;
    }
  }

  let svg;
  try {
    svg = await withRenderLock(async () => {
      const dvi = await tex(tikz, { showConsole: true });
      return dvi2svg(dvi, { embedFontCss: true });
    });
  } catch (err) {
    console.error("[render] failed", {
      ip,
      ms: Date.now() - start,
      error: err.message,
    });
    if (err.message === "Queue full") {
      inc("queue_full");
      res.status(503).send("Server busy");
    } else {
      inc("errors");
      res.status(500).send("Render failed");
    }
    return;
  }

  if (redis) {
    try {
      const gz = zlib.gzipSync(svg);
      await redis.setBuffer(key, gz, "EX", 60 * 60 * 24 * 7);
    } catch {
      redis = null;
    }
  }

  inc("renders");
  console.info("[render] done", { ip, ms: Date.now() - start });
  res.type("image/svg+xml").send(svg);
});

app.listen(3000);
