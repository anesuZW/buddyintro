/**
 * Deterministic CloudLinux / standard Linux Node.js resolution for remote SSH.
 * Single source of truth — no find /opt/alt, no duplicated detection logic.
 */
const { bashRemote, sshExecCapture } = require("./ssh");

const CLOUDLINUX_CANDIDATES = [
  "/opt/alt/alt-nodejs20/root/usr/bin",
  "/opt/alt/alt-nodejs18/root/usr/bin",
  "/opt/alt/alt-nodejs16/root/usr/bin",
];

/** @type {{ binDir: string | null, nodeVersion: string | null, npmVersion: string | null, prismaVersion: string | null }} */
const cache = {
  binDir: null,
  nodeVersion: null,
  npmVersion: null,
  prismaVersion: null,
};

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@%-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function parseResolveOutput(output) {
  const line = (output || "").trim().split("\n").pop()?.trim() || "";
  if (!line || line === "NODE_NOT_FOUND") return null;
  return line;
}

function parseVerifyOutput(output) {
  const lines = (output || "")
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const nodeLine = lines.find((l) => /^v\d/.test(l));
  const npmLine = lines.find((l) => /^\d+\.\d+/.test(l) && l !== nodeLine);
  return {
    nodeVersion: nodeLine || lines[0] || "",
    npmVersion: npmLine || lines[1] || "",
  };
}

/** Verify DEPLOY_NODE_BIN on the server: test -x "$DEPLOY_NODE_BIN/node" */
function buildVerifyConfiguredBinScript(binDir) {
  const q = shellQuote(binDir);
  return bashRemote(`if [ -x ${q}/node ]; then echo ${q}; else echo NODE_NOT_FOUND; exit 1; fi`);
}

/**
 * Remote resolve when DEPLOY_NODE_BIN is unset:
 * CloudLinux candidates (test -x), then which node.
 */
function buildRemoteResolveScript() {
  const steps = [];
  for (const candidate of CLOUDLINUX_CANDIDATES) {
    steps.push(`if [ -x ${candidate}/node ]; then echo ${candidate}; exit 0; fi`);
  }
  steps.push('NODE=$(which node 2>/dev/null || true)');
  steps.push('if [ -n "$NODE" ] && [ -x "$NODE" ]; then dirname "$NODE"; exit 0; fi');
  steps.push('echo "NODE_NOT_FOUND"; exit 1');
  return bashRemote(steps.join("; "));
}

/**
 * Prepend resolved Node bin directory to PATH for every remote node/npm/npx/prisma command.
 */
function withNodeEnvironment(command, binDir) {
  const dir = binDir || getRemoteNodeBin();
  const escaped = dir.replace(/"/g, '\\"');
  return bashRemote(`export PATH="${escaped}:$PATH" && ${command}`);
}

/** cd into app directory and run commands with Node on PATH. */
function remoteScript(appPath, commands, binDir) {
  const expanded = appPath.startsWith("~") ? appPath.replace(/^~/, "$HOME") : appPath;
  const quoted = expanded.includes(" ") ? `"${expanded}"` : expanded;
  const inner = `cd ${quoted} && ${commands.join(" && ")}`;
  return withNodeEnvironment(inner, binDir);
}

function getRemoteNodeBin() {
  if (!cache.binDir) {
    throw new Error(
      "Remote Node.js not resolved. Call resolveServerNode() before running remote commands."
    );
  }
  return cache.binDir;
}

function getRemoteNodeEnv() {
  if (!cache.binDir) {
    throw new Error(
      "Remote Node.js not resolved. Call resolveServerNode() before running remote commands."
    );
  }
  return { ...cache };
}

function setRemoteNodeCache(binDir, versions = {}) {
  cache.binDir = binDir;
  cache.nodeVersion = versions.nodeVersion || null;
  cache.npmVersion = versions.npmVersion || null;
  cache.prismaVersion = versions.prismaVersion || null;
}

function resetRemoteNodeCache() {
  cache.binDir = null;
  cache.nodeVersion = null;
  cache.npmVersion = null;
  cache.prismaVersion = null;
}

/** Log resolved path once for deploy troubleshooting. */
function logUsingServerNode(nodeEnv, write = console.log) {
  write(`Using server Node:\n${nodeEnv.binDir}`);
}

/**
 * Resolve the directory containing node and npm on the remote server.
 *
 * 1. DEPLOY_NODE_BIN from .env.local (verified with test -x on server)
 * 2. CloudLinux candidate paths in order
 * 3. which node (standard Linux)
 *
 * @param {{ logger?: object, sshExecCapture?: Function }} [options]
 */
async function resolveServerNode(options = {}) {
  if (cache.binDir && cache.nodeVersion && cache.npmVersion) {
    return getRemoteNodeEnv();
  }

  const capture = options.sshExecCapture || sshExecCapture;
  const logger = options.logger;

  const configuredBin = (process.env.DEPLOY_NODE_BIN || "").trim().replace(/\/$/, "");

  let binDir = null;

  if (configuredBin) {
    binDir = parseResolveOutput(capture(buildVerifyConfiguredBinScript(configuredBin), logger));
  } else {
    binDir = parseResolveOutput(capture(buildRemoteResolveScript(), logger));
  }

  if (!binDir) {
    const hint = configuredBin
      ? `DEPLOY_NODE_BIN=${configuredBin} — test -x "$DEPLOY_NODE_BIN/node" failed on server.`
      : "Set DEPLOY_NODE_BIN in .env.local (CloudLinux) or install Node on the server.";
    throw new Error(`Could not resolve server Node.js.\n${hint}`);
  }

  const verifyOut = capture(withNodeEnvironment("node -v && npm -v", binDir), logger);
  const { nodeVersion, npmVersion } = parseVerifyOutput(verifyOut);

  if (!nodeVersion || !npmVersion) {
    throw new Error(
      `Node.js resolved at ${binDir} but node -v / npm -v failed.\n` +
        `Output: ${verifyOut || "(empty)"}`
    );
  }

  setRemoteNodeCache(binDir, { nodeVersion, npmVersion });
  return getRemoteNodeEnv();
}

/** Verify Prisma via npx using the resolved PATH. */
async function resolveServerPrisma(appPath, options = {}) {
  const capture = options.sshExecCapture || sshExecCapture;
  const logger = options.logger;
  getRemoteNodeBin();

  const out = capture(remoteScript(appPath, ["npx prisma -v"]), logger);
  const prismaVersion = out.split("\n")[0]?.trim() || out;
  cache.prismaVersion = prismaVersion;
  return prismaVersion;
}

module.exports = {
  CLOUDLINUX_CANDIDATES,
  parseResolveOutput,
  parseVerifyOutput,
  buildVerifyConfiguredBinScript,
  buildRemoteResolveScript,
  withNodeEnvironment,
  remoteScript,
  resolveServerNode,
  resolveServerPrisma,
  logUsingServerNode,
  getRemoteNodeBin,
  getRemoteNodeEnv,
  setRemoteNodeCache,
  resetRemoteNodeCache,
};
