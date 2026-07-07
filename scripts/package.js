#!/usr/bin/env node
/** Usage: npm run package */
const { join } = require("path");
const { runNode, CommandError } = require("./lib/exec");
const { ROOT } = require("./lib/paths");

try {
  runNode([join(ROOT, "deployment", "package.js"), ...process.argv.slice(2)], { cwd: ROOT });
} catch (err) {
  if (err instanceof CommandError) console.error(err.format());
  else console.error(err.message);
  process.exit(1);
}
