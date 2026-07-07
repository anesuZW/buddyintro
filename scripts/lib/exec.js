/**
 * Cross-platform process execution — no shell parsing.
 * Works on Windows PowerShell, CMD, Git Bash, Linux, and macOS.
 */
const { spawnSync } = require("child_process");
const path = require("path");

class CommandError extends Error {
  constructor({ command, args, exitCode, stderr, stdout, hint }) {
    const cmdLine = [command, ...args].join(" ");
    super(`Command failed (exit ${exitCode}): ${cmdLine}`);
    this.name = "CommandError";
    this.command = command;
    this.args = args;
    this.exitCode = exitCode ?? 1;
    this.stderr = stderr || "";
    this.stdout = stdout || "";
    this.hint = hint || "";
  }

  format() {
    const lines = [
      `Command:   ${this.command} ${this.args.join(" ")}`,
      `Exit code: ${this.exitCode}`,
    ];
    if (this.stderr.trim()) lines.push(`stderr:\n${this.stderr.trim()}`);
    if (this.stdout.trim() && !this.stderr.trim()) lines.push(`stdout:\n${this.stdout.trim()}`);
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

/** Resolve npm/npx/gh to Windows .cmd shims when needed. */
function resolveExecutable(command) {
  if (process.platform !== "win32") return command;
  const map = {
    npm: "npm.cmd",
    npx: "npx.cmd",
  };
  return map[command] || command;
}

function spawnCommand(command, args, opts = {}) {
  const executable = resolveExecutable(command);
  const capture = Boolean(opts.capture);
  return spawnSync(executable, args, {
    cwd: opts.cwd || process.cwd(),
    env: { ...process.env, ...opts.env },
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : opts.stdio || "inherit",
    shell: false,
    windowsHide: true,
  });
}

function fail(command, args, result, hint) {
  throw new CommandError({
    command,
    args,
    exitCode: result.status,
    stderr: typeof result.stderr === "string" ? result.stderr : result.stderr?.toString?.(),
    stdout: typeof result.stdout === "string" ? result.stdout : result.stdout?.toString?.(),
    hint: hint || HINTS[command] || "",
  });
}

function run(command, args = [], opts = {}) {
  const result = spawnCommand(command, args, opts);
  if (result.status !== 0) fail(command, args, result, opts.hint);
  return result;
}

function runCapture(command, args = [], opts = {}) {
  const result = spawnCommand(command, args, { ...opts, capture: true });
  if (result.status !== 0) fail(command, args, result, opts.hint);
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

// --- Typed helpers ---

function runGit(args, opts) {
  return run("git", args, { hint: HINTS.git, ...opts });
}

function runGitCapture(args, opts) {
  return runCapture("git", args, { hint: HINTS.git, ...opts });
}

function tryGitCapture(args) {
  return tryCapture("git", args, { hint: HINTS.git });
}

function runNode(args, opts) {
  return run(process.execPath, args, { hint: HINTS.node, ...opts });
}

function runNpm(args, opts) {
  return run("npm", args, { hint: HINTS.npm, ...opts });
}

function runNpx(args, opts) {
  return run("npx", args, { hint: HINTS.npx, ...opts });
}

function runGh(args, opts) {
  return run("gh", args, { hint: HINTS.gh, ...opts });
}

function runGhCapture(args, opts) {
  return runCapture("gh", args, { hint: HINTS.gh, ...opts });
}

function tryGhCapture(args) {
  return tryCapture("gh", args, { hint: HINTS.gh });
}

module.exports = {
  CommandError,
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
  spawnCommand,
};
