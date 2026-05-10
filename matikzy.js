import intervalArcsCommands from "./commands/interval-arcs.js";
import functionCommands from "./commands/function.js";
import unitCircleCommands from "./commands/unit-circle.js";
import cuboidCommands from "./commands/cuboid.js";
import geometryCommands from "./commands/geometry.js";

// ─── Command registry ─────────────────────────────────────────────────────────

const COMMANDS = {};

function register(prefix, syntaxCheck, compile) {
  COMMANDS[prefix] = { syntaxCheck, compile };
}

const allCommands = [
  ...intervalArcsCommands,
  ...functionCommands,
  ...unitCircleCommands,
  ...cuboidCommands,
  ...geometryCommands,
];

allCommands.forEach(({ prefix, syntaxCheck, compile }) =>
  register(prefix, syntaxCheck, compile),
);

// ─── Public API ───────────────────────────────────────────────────────────────

function stripComments(src) {
  return src.split("\n").map(line => {
    const i = line.indexOf("//");
    return i === -1 ? line : line.slice(0, i);
  }).join("\n");
}

export function syntaxCheck(matikzy) {
  matikzy = stripComments(matikzy);
  const entry = Object.entries(COMMANDS).find(([prefix]) =>
    matikzy.startsWith(prefix),
  );
  if (!entry) {
    const known = Object.keys(COMMANDS).join(", ");
    return {
      valid: false,
      errors: [`Unknown command. Known commands: ${known}`],
    };
  }
  const [prefix, handler] = entry;
  return handler.syntaxCheck(matikzy.slice(prefix.length).trim());
}

export function compile(matikzy) {
  matikzy = stripComments(matikzy);
  const entry = Object.entries(COMMANDS).find(([prefix]) =>
    matikzy.startsWith(prefix),
  );
  if (!entry) throw new Error(`Unknown command.`);
  const [prefix, handler] = entry;
  const content = matikzy.slice(prefix.length).trim();
  const check = handler.syntaxCheck(content);
  if (!check.valid)
    throw new Error("Syntax errors:\n" + check.errors.join("\n"));
  return handler.compile(content);
}
