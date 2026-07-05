/**
 * CHANGELOG.md management.
 */
const { existsSync, readFileSync, writeFileSync } = require("fs");
const { join } = require("path");
const { ROOT } = require("./paths");
const { generateReleaseNotes } = require("./release-notes");

const CHANGELOG_PATH = join(ROOT, "CHANGELOG.md");

function ensureChangelog(version) {
  const { md, notesPath } = generateReleaseNotes(version);

  const section = md.replace(/^# BuddyIntro v[\d.]+\n\n/, "");

  if (!existsSync(CHANGELOG_PATH)) {
    writeFileSync(
      CHANGELOG_PATH,
      `# Changelog\n\nAll notable changes to BuddyIntro are documented here.\n\n## v${version}\n\n${section}`
    );
    return { changelogPath: CHANGELOG_PATH, notesPath };
  }

  const existing = readFileSync(CHANGELOG_PATH, "utf8");
  if (existing.includes(`## v${version}`)) {
    return { changelogPath: CHANGELOG_PATH, notesPath };
  }

  const headerEnd = existing.indexOf("\n## ");
  const prefix =
    headerEnd === -1
      ? existing.trimEnd() + "\n\n"
      : existing.slice(0, headerEnd).trimEnd() + "\n\n";

  writeFileSync(CHANGELOG_PATH, `${prefix}## v${version}\n\n${section}${existing.slice(headerEnd === -1 ? existing.length : headerEnd)}`);
  return { changelogPath: CHANGELOG_PATH, notesPath };
}

module.exports = { CHANGELOG_PATH, ensureChangelog };
