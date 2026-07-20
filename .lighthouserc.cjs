/** @type {import('@lhci/cli').LHCI.ServerCommand.Options} */
/**
 * Reference thresholds for Lighthouse CI (optional `lhci autorun`).
 * Primary audit path: scripts/lib/lighthouse-audit.js (programmatic, Windows-safe).
 */
const fs = require("fs");
const path = require("path");

const port = process.env.LHCI_PORT || process.env.AUDIT_PORT || "3001";
const base = (process.env.AUDIT_BASE_URL || `http://localhost:${port}`).replace(/\/$/, "");
// Default locale uses as-needed prefix — /login, not /en/login
const loginUrl = process.env.LHCI_URL || `${base}/login`;

const chromeDir = path.join(__dirname, ".lighthouse-chrome");
const tmpDir = path.join(__dirname, ".lighthouse-tmp");
for (const dir of [chromeDir, tmpDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

module.exports = {
  ci: {
    collect: {
      url: [loginUrl],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        chromeFlags: `--no-sandbox --disable-gpu --user-data-dir=${chromeDir}`,
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.75 }],
        "categories:accessibility": ["warn", { minScore: 0.88 }],
        "categories:seo": ["warn", { minScore: 0.88 }],
        "errors-in-console": ["warn", { minScore: 1 }],
        "doctype": ["warn", { minScore: 1 }],
        "geolocation-on-start": ["warn", { minScore: 1 }],
        "notification-on-start": ["warn", { minScore: 1 }],
        "deprecations": ["warn", { minScore: 1 }],
        "is-on-https": "off",
        "redirects-http": "off",
        "charset": "off",
      },
    },
    upload: {
      target: process.env.LHCI_UPLOAD_TARGET || "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
