#!/usr/bin/env node
/** Usage: npm run package */
const { spawnSync } = require("child_process");
const { join } = require("path");
const { ROOT } = require("./lib/paths");

const script = join(ROOT, "deployment", "package.js");
const result = spawnSync("node", [script, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: ROOT,
});
process.exit(result.status ?? 1);
