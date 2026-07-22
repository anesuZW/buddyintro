#!/usr/bin/env node
/**
 * @deprecated Version manifests are written into .next/standalone by sync-standalone.js.
 * Kept as a thin alias for older docs/scripts.
 */
console.warn("write-build-version.js is deprecated — running sync-standalone.js instead");
require("./sync-standalone.js");
