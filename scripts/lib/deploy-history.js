/**
 * Deployment history — append deploys to deployment/history.json (v6).
 */
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("fs");
const { dirname } = require("path");

const MAX_ENTRIES = 500;

function getHistoryPath() {
  return require("./paths").DEPLOY_HISTORY_PATH;
}

function readHistory() {
  const path = getHistoryPath();
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function appendDeploymentHistory(entry) {
  const history = readHistory();
  history.unshift({
    deployId: entry.deployId || entry.backupId || entry.releaseId || "",
    timestamp: entry.timestamp || new Date().toISOString(),
    version: entry.version || "",
    branch: entry.branch || "main",
    sha: entry.sha || "",
    runtimeSha: entry.runtimeSha || "",
    duration: entry.duration || "",
    backupArchive: entry.backupArchive || (entry.deployId ? `${entry.deployId}.tar.gz` : ""),
    rollback: Boolean(entry.rollback),
    health: entry.health || "PASS",
    deployMode: entry.deployMode || "cloudlinux-v6",
    buildId: entry.buildId || "",
  });
  const trimmed = history.slice(0, MAX_ENTRIES);
  const path = getHistoryPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(trimmed, null, 2)}\n`);
  return trimmed[0];
}

module.exports = {
  MAX_ENTRIES,
  readHistory,
  appendDeploymentHistory,
};
