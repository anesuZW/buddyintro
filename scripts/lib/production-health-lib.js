#!/usr/bin/env node
/**
 * Shared helpers for production service verification scripts.
 * Never prints secret values — only presence/absence.
 */
const { existsSync, readFileSync } = require("fs");
const { join } = require("path");
const { ROOT } = require("./paths");

const MAX_UPLOAD_MB = 25;

function envPresent(name) {
  const val = process.env[name];
  return Boolean(val && String(val).trim());
}

function checkEnv(names) {
  return names.map((name) => ({
    name,
    present: envPresent(name),
  }));
}

function readPermissionsPolicyFromNextConfig() {
  try {
    const src = readFileSync(join(ROOT, "next.config.js"), "utf8");
    const match = src.match(/Permissions-Policy["']?\s*,\s*value:\s*"([^"]+)"/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function microphoneAllowedInPolicy(policy) {
  if (!policy) return null;
  return /microphone=\(self\)/i.test(policy) || /microphone=\*/i.test(policy);
}

async function probeUrl(url, options = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      signal: AbortSignal.timeout(options.timeoutMs || 15_000),
      headers: options.headers,
    });
    return {
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - started,
      contentType: res.headers.get("content-type"),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function standaloneManifestPaths() {
  return {
    version: join(ROOT, ".next", "standalone", "build", "version.json"),
    deployment: join(ROOT, ".next", "standalone", "deployment", "build.json"),
  };
}

function mediaRootStatus() {
  const root = process.env.MEDIA_ROOT || join(ROOT, "uploads");
  const resolved = join(ROOT, root.startsWith(".") ? root : root);
  const path = root.startsWith("/") || /^[A-Za-z]:/.test(root) ? root : join(ROOT, root);
  return {
    path,
    exists: existsSync(path),
    writableHint: existsSync(path),
  };
}

module.exports = {
  MAX_UPLOAD_MB,
  envPresent,
  checkEnv,
  readPermissionsPolicyFromNextConfig,
  microphoneAllowedInPolicy,
  probeUrl,
  standaloneManifestPaths,
  mediaRootStatus,
};
