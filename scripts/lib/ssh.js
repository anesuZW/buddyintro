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

/** Wrap command in login shell for generic remote bash (no Node PATH). */
function bashRemote(cmd) {
  const escaped = cmd.replace(/'/g, "'\\''");
  return `bash -lc '${escaped}'`;
}

module.exports = {
  sshExec,
  sshExecCapture,
  bashRemote,
  verifySshReachable,
  sshBaseArgs,
};
