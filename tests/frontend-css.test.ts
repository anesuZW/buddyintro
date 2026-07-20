import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("frontend CSS pipeline", () => {
  it("imports globals.css exactly once from root layout", () => {
    const rootLayout = fs.readFileSync(path.join("app", "layout.tsx"), "utf8");
    const localeLayout = fs.readFileSync(path.join("app", "[locale]", "layout.tsx"), "utf8");

    assert.match(rootLayout, /import\s+["']@\/styles\/globals\.css["']/);
    assert.doesNotMatch(localeLayout, /globals\.css/);
  });

  it("defines Tailwind layers in globals.css", () => {
    const css = fs.readFileSync(path.join("styles", "globals.css"), "utf8");
    assert.match(css, /@tailwind base/);
    assert.match(css, /@tailwind components/);
    assert.match(css, /@tailwind utilities/);
  });

  it("has a single PWA provider entry (no PwaShell)", () => {
    assert.equal(fs.existsSync("components/pwa/PwaShell.tsx"), false);
    assert.equal(fs.existsSync("components/pwa/PwaProviders.tsx"), true);
  });
});
