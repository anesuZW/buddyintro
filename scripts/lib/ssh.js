/**
 * SSH execution — public-key auth only (BatchMode, no passwords).
 * Remote commands are passed as a single SSH argument (no local shell).
 */
const { spawnCommand, CommandError } = require("./exec");
const { getDeployConfig } = require("./deploy-config");

function sshBaseArgs(config) {
  return [
    "-i",
    config.keyPath,
    "-p",
    String(config.port),
    "-o",
    "BatchMode=yes",
    "-o",
    "PasswordAuthentication=no",
    "-o",
    "PreferredAuthentications=publickey",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=15",
    `${config.user}@${config.host}`,
  ];
}

function getConfig() {
  return getDeployConfig();
}

function verifySshReachable(config = getConfig()) {
  const result = spawnCommand("ssh", [...sshBaseArgs(config), "echo", "ok"], { capture: true });
  if (result.status !== 0 || !(result.stdout || "").includes("ok")) {
    throw new CommandError({
      command: "ssh",
      args: ["echo ok"],
      exitCode: result.status,
      stderr: result.stderr || "",
      hint: "Verify DEPLOY_SSH_HOST, DEPLOY_SSH_KEY, and network connectivity.",
    });
  }
}

function logCapturedStreams(logger, label, stdout, stderr) {
  if (!logger) return;
  if (stdout.trim()) logger.logOutput("STDOUT", stdout);
  if (stderr.trim()) logger.logOutput("STDERR", stderr);
  if (!stdout.trim() && !stderr.trim()) {
    logger.write(`${label}: (no captured output)`);
  }
}

function printCapturedStreams(stdout, stderr) {
  if (stdout.trim()) {
    console.error("\n--- remote stdout ---");
    console.error(stdout);
  }
  if (stderr.trim()) {
    console.error("\n--- remote stderr ---");
    console.error(stderr);
  }
}

function sshExec(remoteCommand, stepName, logger) {
  const config = getConfig();
  const label = stepName || remoteCommand.slice(0, 80);
  console.log(`\n→ SSH: ${label}`);
  if (logger) logger.logCommand(label, remoteCommand);

  const started = Date.now();
  const result = spawnCommand("ssh", [...sshBaseArgs(config), remoteCommand], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    const err = new CommandError({
      command: "ssh",
      args: [label, remoteCommand],
      exitCode: result.status,
      stderr: result.stderr?.toString?.() || "",
      hint: "Verify SSH key, host, and that the server is reachable.",
    });
    err.step = label;
    err.remoteCommand = remoteCommand;
    if (logger) {
      logger.logStep({
        step: label,
        command: remoteCommand,
        status: "FAILED",
        durationMs: Date.now() - started,
        stderr: err.stderr,
        error: err.message,
      });
    }
    throw err;
  }

  if (logger) {
    logger.logStep({
      step: label,
      command: remoteCommand,
      status: "SUCCESS",
      durationMs: Date.now() - started,
    });
  }
}

function sshExecCapture(remoteCommand, logger) {
  const config = getConfig();
  const started = Date.now();
  const result = spawnCommand("ssh", [...sshBaseArgs(config), remoteCommand], {
    capture: true,
  });

  if (result.status !== 0) {
    if (logger) {
      logger.logStep({
        step: "ssh-capture",
        command: remoteCommand,
        status: "FAILED",
        durationMs: Date.now() - started,
        stderr: result.stderr || "",
      });
    }
    throw new CommandError({
      command: "ssh",
      args: [remoteCommand],
      exitCode: result.status,
      stderr: result.stderr || "",
      hint: "Verify SSH key and server connectivity.",
    });
  }

  const stdout = (result.stdout || "").trim();
  if (logger) {
    logger.logStep({
      step: "ssh-capture",
      command: remoteCommand,
      status: "SUCCESS",
      durationMs: Date.now() - started,
      stdout,
    });
  }
  return stdout;
}

/**
 * Run a remote command with captured stdout/stderr.
 * On failure, logs full output to the deploy log and console before throwing.
 */
function sshExecCaptured(remoteCommand, stepName, logger) {
  const config = getConfig();
  const label = stepName || remoteCommand.slice(0, 80);
  console.log(`\n→ SSH (capture): ${label}`);
  if (logger) logger.logCommand(label, remoteCommand);

  const started = Date.now();
  const result = spawnCommand("ssh", [...sshBaseArgs(config), remoteCommand], {
    capture: true,
  });

  const stdout = typeof result.stdout === "string" ? result.stdout : result.stdout?.toString?.() || "";
  const stderr = typeof result.stderr === "string" ? result.stderr : result.stderr?.toString?.() || "";

  if (result.status !== 0 || result.error) {
    printCapturedStreams(stdout, stderr);
    if (logger) {
      logger.logStep({
        step: label,
        command: remoteCommand,
        status: "FAILED",
        durationMs: Date.now() - started,
        stdout,
        stderr,
        error: result.error ? result.error.message : `exit code ${result.status}`,
      });
    }

    const err = new CommandError({
      command: "ssh",
      args: [label, remoteCommand],
      exitCode: result.status ?? 1,
      stdout,
      stderr,
      hint: "Remote command failed. Full compiler output is in the deploy log above.",
      display: `ssh ${label}`,
    });
    err.step = label;
    err.remoteCommand = remoteCommand;
    throw err;
  }

  if (logger) {
    logger.logStep({
      step: label,
      command: remoteCommand,
      status: "SUCCESS",
      durationMs: Date.now() - started,
      stdout: stdout.trim() ? stdout : undefined,
      stderr: stderr.trim() ? stderr : undefined,
    });
  }

  if (stdout.trim()) console.log(stdout);
  if (stderr.trim()) console.error(stderr);

  return { stdout, stderr };
}

/** Wrap command in login shell for generic remote bash (no Node PATH). */
function bashRemote(cmd) {
  const escaped = cmd.replace(/'/g, "'\\''");
  return `bash -lc '${escaped}'`;
}

module.exports = {
  sshExec,
  sshExecCapture,
  sshExecCaptured,
  bashRemote,
  verifySshReachable,
  sshBaseArgs,
  logCapturedStreams,
};
