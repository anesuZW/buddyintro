/**
 * Prisma migration history rebuild — structural tests.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = path.join(ROOT, "prisma", "migrations");
const ARCHIVE = path.join(ROOT, "prisma", "migrations_archive");

function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS)
    .filter((e) => fs.statSync(path.join(MIGRATIONS, e)).isDirectory())
    .filter((e) => /^\d{4}_/.test(e))
    .sort();
}

describe("Migration folder structure", () => {
  it("uses deterministic 000N_ prefixes", () => {
    const folders = listMigrations();
    assert.ok(folders.length >= 7);
    assert.equal(folders[0], "0001_baseline");
    for (const f of folders) {
      assert.match(f, /^\d{4}_[a-z0-9_]+$/);
    }
  });

  it("archived pre-rebuild migrations", () => {
    assert.ok(fs.existsSync(ARCHIVE));
    const archives = fs.readdirSync(ARCHIVE);
    assert.ok(archives.some((a) => a.startsWith("pre-rebuild-")));
  });

  it("removed obsolete standalone SQL from migrations/", () => {
    const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"));
    assert.equal(files.length, 0, `standalone SQL remains: ${files.join(", ")}`);
  });

  it("removed old 2026_* migration folders", () => {
    const folders = fs.readdirSync(MIGRATIONS).filter((f) => f.startsWith("2026"));
    assert.equal(folders.length, 0);
  });
});

describe("Migration ordering", () => {
  it("baseline does not FK-reference tables from later migrations", () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, "0001_baseline", "migration.sql"), "utf8");
    const laterTables = [
      "discoveries_posts",
      "introduction_categories",
      "user_connections",
      "notifications",
      "background_jobs",
      "roles",
    ];
    for (const table of laterTables) {
      assert.ok(!sql.includes(`REFERENCES "${table}"`), `0001 references ${table}`);
    }
  });

  it("baseline creates users before stories", () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, "0001_baseline", "migration.sql"), "utf8");
    const usersPos = sql.indexOf('CREATE TABLE "users"');
    const storiesPos = sql.indexOf('CREATE TABLE "stories"');
    assert.ok(usersPos >= 0 && storiesPos > usersPos);
  });

  it("discoveries migration includes conversation_contexts", () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, "0002_discoveries", "migration.sql"), "utf8");
    assert.ok(sql.includes('CREATE TABLE "discoveries_posts"'));
    assert.ok(sql.includes('CREATE TABLE "conversation_contexts"'));
  });

  it("trust graph migration seeds introduction categories", () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, "0003_trust_graph", "migration.sql"), "utf8");
    assert.ok(sql.includes('INSERT INTO "introduction_categories"'));
  });

  it("security migration seeds RBAC roles", () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, "0007_security_rbac", "migration.sql"), "utf8");
    assert.ok(sql.includes('INSERT INTO "roles"'));
    assert.ok(sql.includes("SuperAdmin"));
  });
});

describe("Deployment pipeline compatibility", () => {
  const { setRemoteNodeCache, resetRemoteNodeCache } = require("../scripts/lib/resolve-server-node");
  const BIN = "/opt/alt/alt-nodejs20/root/usr/bin";

  it("remote-deploy exports server activate in staging with prisma migrate (no build)", () => {
    setRemoteNodeCache(BIN);
    const remote = require("../scripts/lib/remote-deploy");
    assert.equal(typeof remote.serverActivateInStagingCommand, "function");
    const cmd = remote.serverActivateInStagingCommand("/app", { runMigrations: true });
    resetRemoteNodeCache();
    assert.ok(cmd.includes("cd staging"));
    assert.ok(cmd.includes("npm install"));
    assert.ok(cmd.includes("prisma generate"));
    assert.ok(cmd.includes("migrate deploy"));
    assert.ok(!cmd.includes("npm run build"));
  });

  it("rollback command restores tar.gz backup without build", () => {
    setRemoteNodeCache(BIN);
    const { restoreBackupCommand } = require("../scripts/lib/remote-deploy");
    const cmd = restoreBackupCommand("/app", "2026-07-17-0930");
    resetRemoteNodeCache();
    assert.ok(cmd.includes("2026-07-17-0930.tar.gz"));
    assert.ok(cmd.includes("tar -xzf"));
    assert.ok(!cmd.includes("npm run build"));
  });
});

describe("Schema source of truth", () => {
  it("schema.prisma was not modified during rebuild", () => {
    const schema = fs.readFileSync(path.join(ROOT, "prisma", "schema.prisma"), "utf8");
    assert.ok(schema.includes('model User {'));
    assert.ok(schema.includes('model SecurityEvent {'));
    assert.ok(schema.includes('enum IntroductionVisibilityMode'));
  });
});
