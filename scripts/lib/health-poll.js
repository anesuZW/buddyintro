/**
 * Health endpoint polling for deploy and rollback.
 */
async function pollHealth(url, options = {}) {
  const maxMs = options.maxMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 5_000;
  const requireHealthy = options.requireHealthy ?? true;
  const deadline = Date.now() + maxMs;
  let lastError = "unknown";

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
      } else {
        const body = await res.json();
        if (!requireHealthy || body.status === "healthy" || body.status === "degraded") {
          return { ok: true, status: body.status, body };
        }
        lastError = `status=${body.status}`;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (options.onWait) options.onWait(lastError);
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return { ok: false, error: `Health check failed within ${maxMs}ms — last error: ${lastError}` };
}

module.exports = { pollHealth };
