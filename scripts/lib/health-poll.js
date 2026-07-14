/**
 * Health and version endpoint polling for deploy and rollback.
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

async function pollHealth(url, options = {}) {
  const maxMs = options.maxMs ?? 180_000;
  const intervalMs = options.intervalMs ?? 5_000;
  const requireHealthy = options.requireHealthy ?? true;
  const initialDelayMs = options.initialDelayMs ?? 0;
  const deadline = Date.now() + maxMs;
  let attempt = 0;
  let lastMessage = "unknown";

  if (initialDelayMs > 0) {
    await new Promise((r) => setTimeout(r, initialDelayMs));
  }

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
      } else if (!requireHealthy || body.status === "healthy" || body.status === "degraded") {
        return { ok: true, status: body.status || `HTTP ${res.status}`, body, attempts: attempt };
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
  const maxMs = options.maxMs ?? 60_000;
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

module.exports = {
  classifyFetchError,
  describeHttpStatus,
  formatAttemptMessage,
  pollHealth,
  pollVersion,
  versionUrlFromBase,
};
