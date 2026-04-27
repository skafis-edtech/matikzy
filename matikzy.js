import intervalArcsCommands from "./commands/interval-arcs.js";
import functionCommands from "./commands/function.js";
import unitCircleCommands from "./commands/unit-circle.js";
import cuboidCommands from "./commands/cuboid.js";

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
];

allCommands.forEach(({ prefix, syntaxCheck, compile }) =>
  register(prefix, syntaxCheck, compile),
);

// ─── Public API ───────────────────────────────────────────────────────────────

export function syntaxCheck(matikzy) {
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
  const entry = Object.entries(COMMANDS).find(([prefix]) =>
    matikzy.startsWith(prefix),
  );
  if (!entry) throw new Error(`Unknown command.`);
  const [prefix, handler] = entry;
  const content = matikzy.slice(prefix.length).trim();
  const check = handler.syntaxCheck(content);
  if (!check.valid)
    throw new Error("Syntax errors:\n" + check.errors.join("\n"));
  const tikzContent = handler.compile(content);
  return `\\begin{document}\n\\begin{tikzpicture}\n${tikzContent}\n\\end{tikzpicture}\n\\end{document}`;
}
