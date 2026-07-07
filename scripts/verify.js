#!/usr/bin/env node
/** Usage: npm run verify */
const { runNpm, runNpx, CommandError } = require("./lib/exec");

console.log("\n=== BuddyIntro Verify ===\n");

try {
  console.log("1/3 ESLint…");
  runNpm(["run", "lint"]);
  console.log("\n2/3 TypeScript…");
  runNpx(["tsc", "--noEmit"]);
  console.log("\n3/3 Tests…");
  runNpm(["test"]);
  console.log("\n✓ Verify passed\n");
} catch (err) {
  console.error("\n✗ Verify failed:");
  if (err instanceof CommandError) console.error(err.format());
  else console.error(err.message);
  process.exit(1);
}
