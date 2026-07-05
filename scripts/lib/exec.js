/**
 * Shell command helpers for release scripts.
 */
const { spawnSync } = require("child_process");

function run(cmd, args = [], opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    cwd: opts.cwd || process.cwd(),
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (exit ${result.status}): ${cmd} ${args.join(" ")}`);
  }
  return result;
}

function runCapture(cmd, args = [], opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    cwd: opts.cwd || process.cwd(),
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
  return (result.stdout || "").trim();
}

module.exports = { run, runCapture };
