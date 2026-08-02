import fs from "fs";
import { loadEnv, parseDbUrl, redactUrl } from "./load-env.mjs";

loadEnv();
const out = {
  at: new Date().toISOString(),
  urls: {},
};
for (const key of ["DATABASE_URL", "DIRECT_URL", "DATABASE_POOLER_URL"]) {
  const raw = process.env[key];
  out.urls[key] = raw
    ? { redacted: redactUrl(raw), ...parseDbUrl(raw), passwordPresent: /:(?:[^@/]+)@/.test(raw) }
    : null;
}
fs.mkdirSync("docs/performance/db-forensics/artifacts", { recursive: true });
fs.writeFileSync(
  "docs/performance/db-forensics/artifacts/url-inspect.json",
  JSON.stringify(out, null, 2)
);
console.log(JSON.stringify(out, null, 2));
