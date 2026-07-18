/**
 * SCP upload for deployment packages.
 */
const { existsSync } = require("fs");
const { basename } = require("path");
const { spawnCommand, CommandError } = require("./exec");

function scpBaseArgs(config) {
  return [
    "-i",
    config.keyPath,
    "-P",
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
    "ConnectTimeout=60",
  ];
}

function shellQuoteRemote(path) {
  const expanded = path.startsWith("~") ? path.replace(/^~/, "$HOME") : path;
  return expanded.includes(" ") ? `"${expanded}"` : expanded;
}

function uploadPackage(localArchivePath, remoteDir, config, logger) {
  if (!existsSync(localArchivePath)) {
    throw new Error(`Package not found: ${localArchivePath}`);
  }

  const remote = `${config.user}@${config.host}:${shellQuoteRemote(remoteDir)}/${basename(localArchivePath)}`;
  const label = `scp ${basename(localArchivePath)}`;
  console.log(`\n→ ${label}`);
  if (logger) logger.logCommand(label, remote);

  const started = Date.now();
  const result = spawnCommand("scp", [...scpBaseArgs(config), localArchivePath, remote], {
    capture: true,
  });

  if (result.status !== 0 || result.error) {
    const stdout = result.stdout?.toString?.() || "";
    const stderr = result.stderr?.toString?.() || "";
    if (logger) {
      logger.logStep({
        step: label,
        command: remote,
        status: "FAILED",
        durationMs: Date.now() - started,
        stdout,
        stderr,
        error: `exit ${result.status}`,
      });
    }
    throw new CommandError({
      command: "scp",
      args: [basename(localArchivePath), remote],
      exitCode: result.status ?? 1,
      stdout,
      stderr,
      hint: "Verify SSH key, host, and remote directory permissions.",
    });
  }

  if (logger) {
    logger.logStep({
      step: label,
      command: remote,
      status: "SUCCESS",
      durationMs: Date.now() - started,
    });
  }

  return { remotePath: `${remoteDir}/${basename(localArchivePath)}`, durationMs: Date.now() - started };
}

module.exports = {
  uploadPackage,
  scpBaseArgs,
};
