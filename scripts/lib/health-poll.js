/**
 * Health and version endpoint polling for deploy and rollback (v6).
 *
 * - On 404/502 during startup, continues polling (does not fail instantly)
 * - Optional onAnomaly callback collects Passenger diagnostics once
 * - Post-deploy validation checks database, supabase, storage, response time
 */
function classifyFetchError(err) {
  const message = err instanceof Error ? err.message : String(err);
  const code = err?.cause?.code || err?.code || "";

  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || /getaddrinfo/i.test(message)) {
    return "DNS resolution failed";
  }
  if (
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "CERT_HAS_EXPIRED" ||
    /certificate|TLS|SSL/i.test(message)
  ) {
    return "TLS handshake failed";
  }
  if (
    err?.name === "TimeoutError" ||
    err?.name === "AbortError" ||
    code === "ETIMEDOUT" ||
    /timeout/i.test(message)
  ) {
    return "Connection timeout";
  }
  return message;
}

function describeHttpStatus(status, body) {
  if (status === 404) return "Route not found — Passenger may still be starting";
  if (status === 502) return "Bad gateway — upstream not ready";
  if (status === 503) {
    if (body?.error?.includes?.("Prisma") || body?.database === "error") {
      return "Prisma initialization failed";
    }
    return "Application starting";
  }
  if (status === 500) {
    if (body?.error?.includes?.("Prisma") || body?.database === "error") {
      return "Prisma initialization failed";
    }
    return "Internal server error";
  }
  if (status >= 400) return `HTTP ${status}`;
  return "";
}

function formatAttemptMessage(attempt, statusOrReason, detail, bodySnippet) {
  const lines = [`Attempt ${attempt}`];
  if (statusOrReason.startsWith("HTTP")) {
    lines.push(statusOrReason);
    if (detail) lines.push(detail);
  } else {
    lines.push(statusOrReason);
  }
  if (bodySnippet) lines.push(`Response: ${bodySnippet}`);
  return lines.join("\n");
}

function truncateBody(body, max = 300) {
  if (!body) return "";
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** HTTP statuses that may occur during Passenger warm-up — keep polling, do not abort early. */
const STARTUP_ANOMALY_STATUSES = new Set([404, 502, 503]);

function validatePostDeployHealth(body, { maxResponseMs = 15_000 } = {}) {
  const issues = [];
  if (!body || typeof body !== "object") {
    issues.push("invalid health response body");
    return issues;
  }
  if (body.status === "unhealthy") {
    issues.push(`overall status=${body.status}`);
  }
  if (body.database === "unhealthy") {
    issues.push("database unhealthy");
  }
  if (body.supabase === "unhealthy") {
    issues.push("supabase unhealthy");
  }
  if (body.storage === "unhealthy") {
    issues.push("storage unhealthy");
  }
  if (typeof body.responseTimeMs === "number" && body.responseTimeMs > maxResponseMs) {
    issues.push(`slow response ${body.responseTimeMs}ms`);
  }
  return issues;
}

async function pollHealth(url, options = {}) {
  const maxMs = options.maxMs ?? 180_000;
  const intervalMs = options.intervalMs ?? 5_000;
  const requireHealthy = options.requireHealthy ?? true;
  const initialDelayMs = options.initialDelayMs ?? 0;
  const onAnomaly = options.onAnomaly;
  const deadline = Date.now() + maxMs;
  let attempt = 0;
  let lastMessage = "unknown";
  let anomalyDiagnosticsRan = false;

  if (initialDelayMs > 0) {
    await new Promise((r) => setTimeout(r, initialDelayMs));
  }

  while (Date.now() < deadline) {
    attempt += 1;
    const fetchStarted = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      const bodyText = await res.text();
      const responseTimeMs = Date.now() - fetchStarted;
      let body = {};
      try {
        body = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        body = { raw: bodyText };
      }
      body.responseTimeMs = responseTimeMs;

      if (!res.ok) {
        const detail = describeHttpStatus(res.status, body);
        lastMessage = formatAttemptMessage(
          attempt,
          `HTTP ${res.status}`,
          detail,
          truncateBody(bodyText)
        );
        if (
          STARTUP_ANOMALY_STATUSES.has(res.status) &&
          onAnomaly &&
          !anomalyDiagnosticsRan
        ) {
          anomalyDiagnosticsRan = true;
          try {
            await onAnomaly({ status: res.status, body, attempt, lastMessage });
          } catch {
            /* diagnostics must not block polling */
          }
        }
      } else if (!requireHealthy || body.status === "healthy" || body.status === "degraded") {
        const postIssues = validatePostDeployHealth(body, options);
        if (postIssues.length && requireHealthy && body.status === "unhealthy") {
          lastMessage = formatAttemptMessage(
            attempt,
            `Health validation failed`,
            postIssues.join("; "),
            truncateBody(body)
          );
        } else {
          return {
            ok: true,
            status: body.status || `HTTP ${res.status}`,
            body,
            attempts: attempt,
            responseTimeMs,
            validationIssues: postIssues,
          };
        }
      } else {
        lastMessage = formatAttemptMessage(
          attempt,
          `HTTP ${res.status}`,
          `status=${body.status}`,
          truncateBody(body)
        );
      }
    } catch (e) {
      const reason = classifyFetchError(e);
      lastMessage = formatAttemptMessage(attempt, reason, "", "");
    }

    if (options.onWait) options.onWait(lastMessage);
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return {
    ok: false,
    error: `Health check failed within ${maxMs}ms\n${lastMessage}`,
    lastMessage,
    attempts: attempt,
  };
}

function versionUrlFromBase(baseUrl) {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/api/health")) {
    return trimmed.replace(/\/api\/health$/, "/api/version");
  }
  if (trimmed.endsWith("/api/version")) return trimmed;
  return `${trimmed}/api/version`;
}

async function pollVersion(url, targetSha, options = {}) {
  const maxMs = options.maxMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 5_000;
  const deadline = Date.now() + maxMs;
  let attempt = 0;
  let lastMessage = "unknown";

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      const bodyText = await res.text();
      let body = {};
      try {
        body = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        body = { raw: bodyText };
      }

      if (!res.ok) {
        const detail = describeHttpStatus(res.status, body);
        lastMessage = formatAttemptMessage(
          attempt,
          `HTTP ${res.status}`,
          detail,
          truncateBody(bodyText)
        );
      } else if (body.commit) {
        const { shasEqual } = require("./git-integrity");
        if (shasEqual(body.commit, targetSha)) {
          return { ok: true, commit: body.commit, body, attempts: attempt };
        }
        lastMessage = `Runtime commit mismatch: ${body.commit} ≠ ${targetSha}`;
      } else {
        lastMessage = formatAttemptMessage(
          attempt,
          "Invalid version response",
          "missing commit field",
          truncateBody(body)
        );
      }
    } catch (e) {
      const reason = classifyFetchError(e);
      lastMessage = formatAttemptMessage(attempt, reason, "", "");
    }

    if (options.onWait) options.onWait(lastMessage);
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return {
    ok: false,
    error: `Version check failed within ${maxMs}ms\n${lastMessage}`,
    lastMessage,
    attempts: attempt,
  };
}

/** Full post-deploy validation: health + version + BUILD_ID on server. */
async function pollPostDeployValidation(config, targetSha, options = {}) {
  const health = await pollHealth(config.healthUrl, {
    maxMs: options.healthMaxMs ?? config.healthPollMaxMs,
    intervalMs: options.intervalMs ?? config.healthPollIntervalMs,
    onWait: options.onWait,
    onAnomaly: options.onAnomaly,
    initialDelayMs: options.initialDelayMs ?? 0,
  });
  if (!health.ok) return { ok: false, phase: "health", health };

  const version = await pollVersion(config.versionUrl, targetSha, {
    maxMs: options.versionMaxMs ?? config.versionPollMaxMs,
    intervalMs: options.intervalMs ?? config.healthPollIntervalMs,
    onWait: options.onWait,
  });
  if (!version.ok) return { ok: false, phase: "version", health, version };

  return { ok: true, health, version };
}

module.exports = {
  classifyFetchError,
  describeHttpStatus,
  formatAttemptMessage,
  validatePostDeployHealth,
  pollHealth,
  pollVersion,
  pollPostDeployValidation,
  versionUrlFromBase,
  STARTUP_ANOMALY_STATUSES,
};
