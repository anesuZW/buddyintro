#!/usr/bin/env node
/**
 * One-time migration: requireUser() -> requireUserApi() in app/api routes.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const API_DIR = path.join(ROOT, "app", "api");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

function migrateFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  if (!src.includes("requireUser") && !src.includes("requireAdmin")) return false;

  const original = src;

  // Skip if already migrated
  if (src.includes("requireUserApi") && !src.match(/\brequireUser\(\)/)) {
    return false;
  }

  // Update imports from @/lib/auth
  src = src.replace(
    /import\s*\{([^}]*)\}\s*from\s*"@\/lib\/auth";/g,
    (match, imports) => {
      let list = imports
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.includes("requireUser")) {
        list = list.filter((i) => i !== "requireUser");
        if (!list.includes("requireUserApi")) list.push("requireUserApi");
        if (!list.includes("isApiAuthError")) list.push("isApiAuthError");
      }
      if (list.includes("requireAdmin")) {
        list = list.filter((i) => i !== "requireAdmin");
        if (!list.includes("requireAdminApi")) list.push("requireAdminApi");
      }
      return `import { ${list.join(", ")} } from "@/lib/auth";`;
    }
  );

  // requireAdmin() -> requireAdminApi with guard
  src = src.replace(
    /(\n\s*)await requireAdmin\(\);/g,
    `$1const adminAuth = await requireAdminApi();\n$1if (adminAuth instanceof NextResponse) return adminAuth;`
  );

  // Add NextResponse import if needed after admin migration
  if (src.includes("instanceof NextResponse") && !src.includes('from "next/server"')) {
    src = `import { NextResponse } from "next/server";\n` + src;
  } else if (
    src.includes("instanceof NextResponse") &&
    src.includes('from "next/server"') &&
    !src.match(/import\s*\{[^}]*NextResponse/)
  ) {
    src = src.replace(
      /import\s*\{([^}]*)\}\s*from\s*"next\/server";/,
      (m, imp) => `import { ${imp.trim()}, NextResponse } from "next/server";`
    );
  }

  // const X = await requireUser();
  src = src.replace(
    /const (\w+) = await requireUser\(\);/g,
    (match, varName) =>
      `const ${varName}Auth = await requireUserApi();\n  if (${varName}Auth instanceof NextResponse) return ${varName}Auth;\n  const ${varName} = ${varName}Auth;`
  );

  // await requireUser(); (no assignment)
  src = src.replace(
    /(\n\s*)await requireUser\(\);/g,
    `$1const authResult = await requireUserApi();\n$1if (authResult instanceof NextResponse) return authResult;`
  );

  // () => requireUser() in callbacks
  src = src.replace(
    /\(\)\s*=>\s*requireUser\(\)/g,
    "async () => {\n      const authResult = await requireUserApi();\n      if (authResult instanceof NextResponse) throw authResult;\n      return authResult;\n    }"
  );

  // .catch(() => null) pattern in analytics/pwa
  src = src.replace(
    /await requireUserApi\(\)\.catch\(\(\) => null\)/g,
    "await requireUserApi().then((r) => (r instanceof NextResponse ? null : r))"
  );

  if (src !== original) {
    fs.writeFileSync(filePath, src);
    return true;
  }
  return false;
}

let count = 0;
for (const file of walk(API_DIR)) {
  if (migrateFile(file)) {
    console.log("migrated:", path.relative(ROOT, file));
    count++;
  }
}
console.log(`Done. ${count} file(s) updated.`);
