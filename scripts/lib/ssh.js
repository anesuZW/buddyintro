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
    `${config.user}@${config.host}`,
  ];
}

function sshExec(remoteCommand, stepName) {
  const config = getDeployConfig();
  const label = stepName || remoteCommand.slice(0, 80);
  console.log(`\n→ SSH: ${label}`);

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
    throw err;
  }
}

function sshExecCapture(remoteCommand) {
  const config = getDeployConfig();
  const result = spawnCommand("ssh", [...sshBaseArgs(config), remoteCommand], {
    capture: true,
  });

  if (result.status !== 0) {
    throw new CommandError({
      command: "ssh",
      args: [remoteCommand],
      exitCode: result.status,
      stderr: result.stderr || "",
      hint: "Verify SSH key and server connectivity.",
    });
  }
  return (result.stdout || "").trim();
}

/** Build a remote shell command without local shell parsing. */
function remoteScript(appPath, commands) {
  const quoted = appPath.includes(" ") ? `"${appPath}"` : appPath;
  return `cd ${quoted} && ${commands.join(" && ")}`;
}

module.exports = { sshExec, sshExecCapture, remoteScript };
