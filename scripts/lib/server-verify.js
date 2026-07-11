/**
 * Server verification routines (via SSH).
 */
const { sshExecCapture, bashRemote, remoteScript } = require("./ssh");
const { satisfiesMinVersion } = require("./node-version");
const { remoteEnvCheckScript } = require("./deploy-env");

function check(name, status, message) {
  return { name, status, message };
}

async function runServerChecks(config) {
  const app = config.appPath;
  const branch = config.gitBranch;
  const results = [];

  const run = (name, fn) => {
    try {
      results.push(fn());
    } catch (e) {
      results.push(check(name, "FAIL", e instanceof Error ? e.message : String(e)));
    }
  };

  run("Repository exists", () => {
    const appDir = quote(app.replace(/^~/, "$HOME"));
    const out = sshExecCapture(bashRemote(`test -d ${appDir}/.git && echo yes || echo no`));
    return check("Repository exists", out === "yes" ? "PASS" : "FAIL", out === "yes" ? "Git repo found" : "No .git directory");
  });

  run("Correct branch tracking", () => {
    const out = sshExecCapture(remoteScript(app, [`git rev-parse --abbrev-ref HEAD`]));
    const tracking = sshExecCapture(
      remoteScript(app, [`git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo none`])
    );
    const ok = out === branch || tracking.includes(`origin/${branch}`);
    return check(
      "Correct branch tracking",
      ok ? "PASS" : "WARNING",
      `HEAD=${out}, upstream=${tracking}`
    );
  });

  run("Clean working tree", () => {
    const out = sshExecCapture(remoteScript(app, ["git status --porcelain"]));
    const clean = !out || out.trim() === "";
    return check("Clean working tree", clean ? "PASS" : "WARNING", clean ? "Clean" : "Dirty tree detected");
  });

  run("Node version", () => {
    const out = sshExecCapture(remoteScript(app, ["node -v"]));
    const ok = satisfiesMinVersion(out, config.nodeMinVersion);
    return check(
      "Node version",
      ok ? "PASS" : "FAIL",
      `${out} (required ${config.nodeMinVersion})`
    );
  });

  run("npm version", () => {
    const out = sshExecCapture(remoteScript(app, ["npm -v"]));
    return check("npm version", out ? "PASS" : "FAIL", out || "unknown");
  });

  run("Prisma version", () => {
    const out = sshExecCapture(remoteScript(app, ["npx prisma -v"]));
    return check("Prisma version", out ? "PASS" : "WARNING", out ? out.split("\n")[0] : "unknown");
  });

  run("Disk space", () => {
    const out = sshExecCapture(bashRemote("df -h . 2>/dev/null | tail -1 || echo unknown"));
    const warn = /9[0-9]%|100%/.test(out);
    return check("Disk space", warn ? "WARNING" : "PASS", out);
  });

  run("Memory", () => {
    const out = sshExecCapture(bashRemote("free -m 2>/dev/null | head -2 || echo unknown"));
    return check("Memory", out.includes("unknown") ? "WARNING" : "PASS", out.replace(/\n/g, " | "));
  });

  run("Passenger restart file", () => {
    const appDir = quote(app.replace(/^~/, "$HOME"));
    const out = sshExecCapture(bashRemote(`test -f ${appDir}/tmp/restart.txt && echo yes || echo no`));
    return check(
      "Passenger restart file",
      out === "yes" ? "PASS" : "WARNING",
      out === "yes" ? "tmp/restart.txt exists" : "Will be created on deploy"
    );
  });

  run("GitHub remote reachable", () => {
    const out = sshExecCapture(remoteScript(app, ["git ls-remote --heads origin 2>&1 | head -1"]));
    const ok = out && !out.toLowerCase().includes("fatal");
    return check("GitHub remote reachable", ok ? "PASS" : "FAIL", ok ? "origin reachable" : out);
  });

  run("Database configured", () => {
    sshExecCapture(remoteScript(app, [remoteEnvCheckScript(["DATABASE_URL"])]));
    return check("Database configured", "PASS", "DATABASE_URL present in server .env");
  });

  run("Supabase reachable", () => {
    const out = sshExecCapture(
      remoteScript(app, [
        "bash -lc 'set -a; [ -f .env ] && . ./.env; set +a; curl -sf \"$NEXT_PUBLIC_SUPABASE_URL/auth/v1/health\" -o /dev/null && echo ok || echo fail'",
      ])
    );
    return check("Supabase reachable", out.includes("ok") ? "PASS" : "WARNING", out || "Could not verify");
  });

  return results;
}

function quote(path) {
  return path.includes(" ") ? `"${path}"` : path;
}

module.exports = { runServerChecks, check };
