/**
 * Verify backup integrity.
 *
 * Usage:
 *   npm run backup:verify
 *   npm run backup:verify -- --dir=backups/2026-06-21T12-00-00-000Z
 */
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      // ignore
    }
  }
}

loadEnv();

function latestBackupDir(): string {
  const root = resolve(process.cwd(), "backups");
  if (!existsSync(root)) throw new Error("No backups/ directory found");
  const dirs = readdirSync(root)
    .map((name) => resolve(root, name))
    .filter((p) => statSync(p).isDirectory())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!dirs.length) throw new Error("No backup directories found");
  return dirs[0];
}

const dirArg = process.argv.find((a) => a.startsWith("--dir="))?.split("=")[1];
const backupDir = dirArg ? resolve(process.cwd(), dirArg) : latestBackupDir();

function verify(): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(backupDir)) {
    errors.push(`Backup directory not found: ${backupDir}`);
    return { ok: false, errors, warnings };
  }

  const manifestPath = resolve(backupDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    errors.push("manifest.json missing");
    return { ok: false, errors, warnings };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    method: string;
    createdAt: string;
    tables?: string[];
  };

  if (manifest.method === "pg_dump") {
    const dumpPath = resolve(backupDir, "buddyintro.dump");
    if (!existsSync(dumpPath)) {
      errors.push("buddyintro.dump missing");
    } else if (statSync(dumpPath).size < 1024) {
      warnings.push("buddyintro.dump is very small (<1KB)");
    }
  } else {
    const jsonlFiles = readdirSync(backupDir).filter((f) => f.endsWith(".jsonl"));
    if (!jsonlFiles.length) {
      errors.push("No .jsonl table exports found");
    }
    for (const file of jsonlFiles) {
      const size = statSync(resolve(backupDir, file)).size;
      if (size === 0) warnings.push(`${file} is empty`);
    }
  }

  if (!existsSync(resolve(backupDir, "RESTORE.md"))) {
    warnings.push("RESTORE.md missing");
  }

  return { ok: errors.length === 0, errors, warnings };
}

const result = verify();
console.log(`Verifying: ${backupDir}`);
if (result.errors.length) {
  console.error("ERRORS:");
  for (const e of result.errors) console.error(`  - ${e}`);
}
if (result.warnings.length) {
  console.warn("WARNINGS:");
  for (const w of result.warnings) console.warn(`  - ${w}`);
}

console.log(result.ok ? "PASS — backup integrity OK" : "FAIL — backup integrity check failed");
process.exit(result.ok ? 0 : 1);
