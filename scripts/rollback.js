#!/usr/bin/env node
/**
 * @deprecated Use `npm run deploy:rollback` instead.
 */
console.warn("Note: `npm run rollback` now uses release-based rollback (npm run deploy:rollback).");
require("./deploy-rollback.js");
