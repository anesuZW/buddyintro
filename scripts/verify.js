#!/usr/bin/env node
/** Usage: npm run verify */
const { run } = require("./lib/exec");

console.log("\n=== BuddyIntro Verify ===\n");
console.log("1/3 ESLint…");
run("npm", ["run", "lint"]);
console.log("\n2/3 TypeScript…");
run("npx", ["tsc", "--noEmit"]);
console.log("\n3/3 Tests…");
run("npm", ["test"]);
console.log("\n✓ Verify passed\n");
