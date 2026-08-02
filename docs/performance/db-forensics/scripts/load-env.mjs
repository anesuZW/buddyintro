import fs from "fs";

export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && process.env[m[1]] == null) process.env[m[1]] = m[2];
    }
  }
}

export function parseDbUrl(raw) {
  if (!raw) return null;
  const normalized = raw.replace(/^postgres(ql)?:/i, "http:");
  const u = new URL(normalized);
  const params = Object.fromEntries(u.searchParams.entries());
  return {
    protocol: raw.split(":")[0],
    host: u.hostname,
    port: Number(u.port || 5432),
    database: (u.pathname || "/").replace(/^\//, "") || "postgres",
    user: u.username,
    params,
    hasPgBouncer:
      params.pgbouncer === "true" ||
      u.hostname.includes("pooler") ||
      u.port === "6543",
    isPoolerHost: u.hostname.includes("pooler"),
    isDirectHost: u.hostname.startsWith("db.") && u.hostname.includes("supabase"),
  };
}

export function redactUrl(raw) {
  if (!raw) return null;
  try {
    const p = parseDbUrl(raw);
    return `${p.protocol}://${p.user ? p.user.slice(0, 4) + "***" : "***"}@${p.host}:${p.port}/${p.database}`;
  } catch {
    return "***";
  }
}
