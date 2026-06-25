import fs from "fs";
import path from "path";

export type Severity = "SAFE" | "WARNING" | "CRITICAL" | "INFO";

export type AuditFinding = {
  severity: Severity;
  category: string;
  title: string;
  detail?: string;
  file?: string;
  function?: string;
  recommendation?: string;
};

export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

export function printReport(title: string, findings: AuditFinding[]) {
  const order: Record<Severity, number> = {
    CRITICAL: 0,
    WARNING: 1,
    INFO: 2,
    SAFE: 3,
  };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.title.localeCompare(b.title));

  console.log(`\n=== ${title} ===\n`);
  const counts = { CRITICAL: 0, WARNING: 0, INFO: 0, SAFE: 0 };
  for (const f of findings) {
    counts[f.severity]++;
    const loc = f.file ? ` (${f.file}${f.function ? `#${f.function}` : ""})` : "";
    console.log(`[${f.severity}] ${f.category}: ${f.title}${loc}`);
    if (f.detail) console.log(`  ${f.detail}`);
    if (f.recommendation) console.log(`  → ${f.recommendation}`);
  }
  console.log(
    `\nSummary: ${counts.CRITICAL} critical, ${counts.WARNING} warning, ${counts.INFO} info, ${counts.SAFE} safe`
  );
  return counts.CRITICAL;
}

export function walkTsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkTsFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

export function rel(p: string) {
  return path.relative(process.cwd(), p).replace(/\\/g, "/");
}
