/**
 * Migration certification audit tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  MIGRATION_ORDER,
  TABLE_MIGRATION,
  auditFkOrdering,
  auditSeeds,
  auditDuplicates,
  auditBaselineCompleteness,
  auditSchemaEnums,
  runStaticAudit,
} = require("../scripts/lib/migration-audit");

const ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATIONS = path.join(ROOT, "prisma", "migrations");

describe("Migration ordering", () => {
  it("uses deterministic 0001–0008 chain", () => {
    const folders = fs
      .readdirSync(MIGRATIONS)
      .filter((e) => fs.statSync(path.join(MIGRATIONS, e)).isDirectory())
      .filter((e) => /^\d{4}_/.test(e))
      .sort();
    assert.deepEqual(folders, MIGRATION_ORDER);
  });

  it("baseline is first", () => {
    assert.equal(MIGRATION_ORDER[0], "0001_baseline");
  });
});

describe("FK ordering", () => {
  it("has no FK references to future tables", () => {
    const issues = auditFkOrdering();
    assert.equal(issues.length, 0, issues.join("\n"));
  });

  it("places cross-domain FKs in later migrations", () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, "0003_trust_graph", "migration.sql"), "utf8");
    assert.ok(sql.includes("stories_introduction_category_id_fkey"));
    assert.ok(sql.includes("discoveries_posts_introduction_category_id_fkey"));
  });
});

describe("NOT NULL defaults and seeds", () => {
  it("admin_settings seed includes updated_at", () => {
    const issues = auditSeeds();
    assert.ok(!issues.some((i) => i.includes("admin_settings")));
  });

  it("introduction_categories seed includes id", () => {
    const issues = auditSeeds();
    assert.ok(!issues.some((i) => i.includes("introduction_categories")));
  });

  it("RBAC seed generates UUIDs", () => {
    const issues = auditSeeds();
    assert.ok(!issues.some((i) => i.includes("0007")));
  });
});

describe("Duplicate definitions", () => {
  it("has no duplicate enums or tables", () => {
    const issues = auditDuplicates();
    assert.equal(issues.length, 0, issues.join("\n"));
  });
});

describe("Baseline completeness", () => {
  it("includes all core tables", () => {
    const issues = auditBaselineCompleteness();
    assert.equal(issues.length, 0, issues.join("\n"));
  });
});

describe("Schema enum alignment", () => {
  it("matches schema.prisma enums", () => {
    const issues = auditSchemaEnums();
    assert.equal(issues.length, 0, issues.join("\n"));
  });
});

describe("Static audit summary", () => {
  it("passes all checks", () => {
    const audit = runStaticAudit();
    const all = Object.values(audit).flat();
    assert.equal(all.length, 0, all.join("\n"));
  });
});

describe("TABLE_MIGRATION map", () => {
  it("maps every application table", () => {
    const schema = fs.readFileSync(path.join(ROOT, "prisma", "schema.prisma"), "utf8");
    const models = [...schema.matchAll(/^model (\w+)/gm)].map((m) => {
      const name = m[1];
      return name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
    });
    const prismaTables = [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]);
    for (const table of prismaTables) {
      assert.ok(TABLE_MIGRATION[table], `Missing TABLE_MIGRATION entry: ${table}`);
    }
  });
});
