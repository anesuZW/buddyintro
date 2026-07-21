/**
 * Programmatic Lighthouse run + assertion (Windows-safe Chrome cleanup).
 */
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./paths");

const OUTPUT_DIR = path.join(ROOT, ".lighthouseci");
const CHROME_DIR = path.join(ROOT, ".lighthouse-chrome");
const TMP_DIR = path.join(ROOT, ".lighthouse-tmp");

/** Warn-level thresholds aligned with .lighthouserc.cjs */
const CATEGORY_THRESHOLDS = {
  performance: 0.7,
  accessibility: 0.88,
  seo: 0.88,
};

const AUDIT_THRESHOLDS = {
  "errors-in-console": 1,
  doctype: 1,
  "geolocation-on-start": 1,
  "notification-on-start": 1,
  deprecations: 1,
};

function ensureDirs() {
  for (const dir of [OUTPUT_DIR, CHROME_DIR, TMP_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  process.env.TMP = TMP_DIR;
  process.env.TEMP = TMP_DIR;
}

function slugify(url) {
  return url.replace(/^https?:\/\//, "").replace(/[^\w-]+/g, "_");
}

function writeReport(lhr, url) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "_").slice(0, 19);
  const base = `${slugify(url)}-${stamp}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.report.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(lhr, null, 2));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "manifest.json"),
    JSON.stringify(
      [{ url, isRepresentativeRun: true, jsonPath: path.basename(jsonPath) }],
      null,
      2
    )
  );
  return jsonPath;
}

async function launchChrome() {
  const { launch } = await import("chrome-launcher");
  return launch({
    chromeFlags: [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      `--user-data-dir=${CHROME_DIR}`,
    ],
  });
}

async function killChrome(chrome) {
  if (!chrome) return;
  try {
    await chrome.kill();
  } catch {
    // Windows may throw EPERM while deleting chrome-launcher temp dirs after a successful run.
  }
}

async function collectLighthouse(url) {
  ensureDirs();
  const lighthouse = (await import("lighthouse")).default;
  const chrome = await launchChrome();

  try {
    const runnerResult = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      preset: "desktop",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    return JSON.parse(runnerResult.report);
  } finally {
    await killChrome(chrome);
  }
}

function assertReport(lhr, url) {
  const failures = [];
  const warnings = [];

  for (const [category, minScore] of Object.entries(CATEGORY_THRESHOLDS)) {
    const score = lhr.categories[category]?.score;
    const label = `${category}: ${score == null ? "null" : Math.round(score * 100)}% (min ${Math.round(minScore * 100)}%)`;
    if (score == null || score < minScore) {
      warnings.push(label);
    } else {
      console.log(`  ✓ ${label}`);
    }
  }

  for (const [auditId, minScore] of Object.entries(AUDIT_THRESHOLDS)) {
    const audit = lhr.audits[auditId];
    if (!audit) {
      warnings.push(`${auditId}: audit missing`);
      continue;
    }
    if (audit.scoreDisplayMode === "error") {
      warnings.push(`${auditId}: gatherer error (${audit.title})`);
      continue;
    }
    const score = audit.score;
    const label = `${auditId}: ${score == null ? "n/a" : Math.round(score * 100)}%`;
    if (score != null && score < minScore) {
      warnings.push(`${label} (min ${Math.round(minScore * 100)}%)`);
    } else if (score != null) {
      console.log(`  ✓ ${label}`);
    }
  }

  if (warnings.length) {
    console.log("\n  Lighthouse warnings:");
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }

  // Fail only on hard category misses (not best-practices category — LH 12 headless charset bug).
  const hardFails = warnings.filter((w) =>
    /^(performance|accessibility|seo):/.test(w)
  );
  if (hardFails.length) {
    throw new Error(`Lighthouse thresholds not met for ${url}:\n  ${hardFails.join("\n  ")}`);
  }

  return { warnings, reportPath: writeReport(lhr, url) };
}

async function runLighthouseAudit(url) {
  console.log(`→ Lighthouse ${url}`);
  const lhr = await collectLighthouse(url);
  console.log("\n=== Lighthouse results ===\n");
  const result = assertReport(lhr, url);
  console.log(`\n  Report: ${path.relative(ROOT, result.reportPath)}`);
  return result;
}

module.exports = {
  AUDIT_THRESHOLDS,
  CATEGORY_THRESHOLDS,
  assertReport,
  collectLighthouse,
  runLighthouseAudit,
};
