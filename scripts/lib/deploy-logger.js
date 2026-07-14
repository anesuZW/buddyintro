/**
 * Deployment log writer — deployment/logs/deploy-YYYY-MM-DD-HHMM.log
 */
const { existsSync, mkdirSync, appendFileSync } = require("fs");
const { join } = require("path");
const { DEPLOY_LOGS_DIR } = require("./paths");

function timestamp() {
  return new Date().toISOString();
}

function logFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `deploy-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.log`;
}

class DeployLogger {
  constructor() {
    if (!existsSync(DEPLOY_LOGS_DIR)) mkdirSync(DEPLOY_LOGS_DIR, { recursive: true });
    this.path = join(DEPLOY_LOGS_DIR, logFilename());
    this.startedAt = Date.now();
    this.metadata = {};
    this.write(`=== BuddyIntro Deploy Log v3 ===`);
    this.write(`Started: ${timestamp()}`);
  }

  write(line) {
    const entry = `[${timestamp()}] ${line}\n`;
    appendFileSync(this.path, entry);
    return entry.trimEnd();
  }

  log(message) {
    console.log(message);
    this.write(message);
  }

  setMetadata(meta) {
    this.metadata = { ...this.metadata, ...meta };
    for (const [key, value] of Object.entries(meta)) {
      if (value !== undefined && value !== null) {
        this.write(`${key}: ${value}`);
      }
    }
  }

  logCommand(step, command) {
    this.write(`STEP: ${step}`);
    this.write(`COMMAND: ${command}`);
  }

  logOutput(stream, text) {
    if (!text || !text.trim()) return;
    this.write(`${stream}:\n${text.trim()}`);
  }

  logStep({ step, command, status, durationMs, stdout, stderr, error }) {
    this.write(`STEP: ${step}`);
    if (command) this.write(`COMMAND: ${command}`);
    this.write(`STATUS: ${status}`);
    this.write(`DURATION_MS: ${durationMs}`);
    if (stdout) this.logOutput("STDOUT", stdout);
    if (stderr) this.logOutput("STDERR", stderr);
    if (error) this.write(`ERROR: ${error}`);
    this.write("---");
  }

  finalize(status, extra = {}) {
    const durationMs = Date.now() - this.startedAt;
    this.write(`FINAL_STATUS: ${status}`);
    this.write(`TOTAL_DURATION_MS: ${durationMs}`);
    if (extra.rollbackStatus) this.write(`Rollback status: ${extra.rollbackStatus}`);
    if (extra.healthStatus) this.write(`Health status: ${extra.healthStatus}`);
    if (extra.runtimeSha) this.write(`Runtime SHA: ${extra.runtimeSha}`);
    this.write(`Log file: ${this.path.replace(/\\/g, "/")}`);
    console.log(`\nDeploy log: ${this.path}`);
  }
}

module.exports = { DeployLogger };
