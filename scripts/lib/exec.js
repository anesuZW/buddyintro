/**
 * Cross-platform process execution — no shell parsing.
 * Works on Windows PowerShell, CMD, Git Bash, Linux, and macOS.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const { ROOT } = require("./paths");

class CommandError extends Error {
  constructor({ command, args, exitCode, stderr, stdout, hint, spawnError, display }) {
    const cmdLine = display || [command, ...args].join(" ");
    super(`Command failed (exit ${exitCode}): ${cmdLine}`);
    this.name = "CommandError";
    this.command = command;
    this.args = args;
    this.exitCode = exitCode ?? 1;
    this.stderr = stderr || "";
    this.stdout = stdout || "";
    this.hint = hint || "";
    this.spawnError = spawnError || null;
    this.display = display || cmdLine;
    this.cwd = "";
  }

  format() {
    const lines = [
      `Command:   ${this.display}`,
      `Exit code: ${this.exitCode}`,
      `cwd:       ${this.cwd || ROOT}`,
    ];
    if (this.spawnError) lines.push(`spawn error: ${this.spawnError}`);
    if (this.stderr.trim()) lines.push(`stderr:\n${this.stderr.trim()}`);
    if (this.stdout.trim() && !this.stderr.trim()) lines.push(`stdout:\n${this.stdout.trim()}`);
    if (!this.stderr.trim() && !this.stdout.trim() && !this.spawnError) {
      lines.push("(output was streamed live above)");
    }
    if (this.hint) lines.push(`Suggested fix: ${this.hint}`);
    return lines.join("\n");
  }
}

const HINTS = {
  git: "Ensure Git is installed and available in PATH.",
  gh: "Install GitHub CLI (https://cli.github.com/) and run: gh auth login",
  npm: "Run from the project root after npm install.",
  npx: "Ensure node_modules is installed (npm install).",
  node: "Use the Node.js version specified in package.json engines.",
  ssh: "Verify DEPLOY_SSH_HOST, DEPLOY_SSH_KEY, and that the public key is on the server.",
  tar: "Windows 10+ includes tar; on older systems install zip or tar.",
  zip: "Install zip (e.g. apt install zip) for packaging.",
};

function npmCliPath() {
  return path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
}

function npxCliPath() {
  return path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
}

/**
 * Resolve how to spawn a command cross-platform.
 * Windows: npm.cmd cannot be spawnSync'd with shell:false when Node lives in a
 * path with spaces (EINVAL). Use npm-cli.js via node instead.
 * Linux/macOS: spawn npm/npx directly.
 */
function resolveSpawn(command, args) {
  if (command === "npm") {
    const display = `npm ${args.join(" ")}`;
    if (process.platform === "win32") {
      return {
        executable: process.execPath,
        args: [npmCliPath(), ...args],
        display,
        command: "npm",
      };
    }
    return { executable: "npm", args, display, command: "npm" };
  }

  if (command === "npx") {
    const display = `npx ${args.join(" ")}`;
    if (process.platform === "win32") {
      return {
        executable: process.execPath,
        args: [npxCliPath(), ...args],
        display,
        command: "npx",
      };
    }
    return { executable: "npx", args, display, command: "npx" };
  }

  const display = [command, ...args].join(" ");
  return { executable: command, args, display, command };
}

/** @deprecated Use resolveSpawn — kept for tests */
function resolveExecutable(command) {
  if (process.platform !== "win32") return command;
  if (command === "npm") return "npm.cmd";
  if (command === "npx") return "npx.cmd";
  return command;
}

function logSpawn(display, cwd) {
  console.log(`→ ${display}`);
  console.log(`  cwd: ${cwd}`);
}

function spawnCommand(command, args, opts = {}) {
  const cwd = opts.cwd || ROOT;
  const resolved = resolveSpawn(command, args);
  const capture = Boolean(opts.capture);

  if (!opts.quiet) {
    logSpawn(resolved.display, cwd);
  }

  const result = spawnSync(resolved.executable, resolved.args, {
    cwd,
    env: { ...process.env, ...opts.env },
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : opts.stdio || "inherit",
    shell: false,
    windowsHide: true,
  });

  result._resolved = resolved;
  result._cwd = cwd;
  return result;
}

function fail(command, args, result, hint, opts = {}) {
  const resolved = result._resolved || resolveSpawn(command, args);
  const exitCode = result.status ?? 1;
  const spawnErr = result.error ? `${result.error.code}: ${result.error.message}` : null;

  const err = new CommandError({
    command: resolved.command,
    args: resolved.args,
    exitCode,
    stderr: typeof result.stderr === "string" ? result.stderr : result.stderr?.toString?.(),
    stdout: typeof result.stdout === "string" ? result.stdout : result.stdout?.toString?.(),
    hint: hint || HINTS[resolved.command] || HINTS[command] || "",
    spawnError: spawnErr,
    display: resolved.display,
  });
  err.cwd = result._cwd || opts.cwd || ROOT;
  throw err;
}

function run(command, args = [], opts = {}) {
  const result = spawnCommand(command, args, opts);
  if (result.status !== 0 || result.error) fail(command, args, result, opts.hint, opts);
  return result;
}

function runCapture(command, args = [], opts = {}) {
  const result = spawnCommand(command, args, { ...opts, capture: true });
  if (result.status !== 0 || result.error) fail(command, args, result, opts.hint, opts);
  return (result.stdout || "").trim();
}

function tryCapture(command, args = [], opts = {}) {
  try {
    return runCapture(command, args, opts);
  } catch {
    return null;
  }
}

function tryRun(command, args = [], opts = {}) {
  try {
    run(command, args, opts);
    return true;
  } catch {
    return false;
  }
}

// --- Typed helpers (default cwd = repository root) ---

function runGit(args, opts) {
  return run("git", args, { hint: HINTS.git, cwd: ROOT, ...opts });
}

function runGitCapture(args, opts) {
  return runCapture("git", args, { hint: HINTS.git, cwd: ROOT, ...opts });
}

function tryGitCapture(args) {
  return tryCapture("git", args, { hint: HINTS.git, cwd: ROOT });
}

function runNode(args, opts) {
  return run(process.execPath, args, { hint: HINTS.node, cwd: ROOT, ...opts });
}

function runNpm(args, opts) {
  return run("npm", args, { hint: HINTS.npm, cwd: ROOT, ...opts });
}

function runNpx(args, opts) {
  return run("npx", args, { hint: HINTS.npx, cwd: ROOT, ...opts });
}

function runGh(args, opts) {
  return run("gh", args, { hint: HINTS.gh, cwd: ROOT, ...opts });
}

function runGhCapture(args, opts) {
  return runCapture("gh", args, { hint: HINTS.gh, cwd: ROOT, ...opts });
}

function tryGhCapture(args) {
  return tryCapture("gh", args, { hint: HINTS.gh, cwd: ROOT });
}

module.exports = {
  CommandError,
  ROOT,
  run,
  runCapture,
  tryCapture,
  tryRun,
  runGit,
  runGitCapture,
  tryGitCapture,
  runNode,
  runNpm,
  runNpx,
  runGh,
  runGhCapture,
  tryGhCapture,
  resolveExecutable,
  resolveSpawn,
  npmCliPath,
  npxCliPath,
  spawnCommand,
};
