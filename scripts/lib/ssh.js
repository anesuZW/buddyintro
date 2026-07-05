/**
 * SSH execution — public-key auth only (BatchMode, no passwords).
 */
const { spawnSync } = require("child_process");
const { getDeployConfig } = require("./deploy-config");

function sshArgs(config) {
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
    `${config.user}@${config.host}`,
  ];
}

function sshExec(command, stepName) {
  const config = getDeployConfig();
  const label = stepName || command.slice(0, 80);
  console.log(`\n→ SSH: ${label}`);

  const result = spawnSync("ssh", [...sshArgs(config), command], {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK },
  });

  if (result.status !== 0) {
    const err = new Error(`Deployment failed at step: ${label}`);
    err.step = label;
    err.command = command;
    throw err;
  }
}

function sshExecCapture(command) {
  const config = getDeployConfig();
  const result = spawnSync("ssh", [...sshArgs(config), command], {
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`SSH command failed: ${command}\n${result.stderr || ""}`);
  }
  return (result.stdout || "").trim();
}

module.exports = { sshExec, sshExecCapture };
