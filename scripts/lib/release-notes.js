/**
 * Release notes generation from git history.
 */
const { existsSync, mkdirSync, writeFileSync } = require("fs");
const { join } = require("path");
const { runCapture } = require("./exec");
const { ROOT } = require("./paths");

function gitLogSince(ref) {
  try {
    return runCapture("git", ["log", `${ref}..HEAD`, "--pretty=format:%s|%h|%an"]);
  } catch {
    return runCapture("git", ["log", "-20", "--pretty=format:%s|%h|%an"]);
  }
}

function lastTag() {
  try {
    return runCapture("git", ["describe", "--tags", "--abbrev=0"]);
  } catch {
    return null;
  }
}

function categorize(subject) {
  const s = subject.toLowerCase();
  if (s.startsWith("fix") || s.includes("bug")) return "bugFixes";
  if (s.includes("perf") || s.includes("optim")) return "performance";
  if (s.includes("security") || s.includes("sec:")) return "security";
  if (s.includes("prisma") || s.includes("migration") || s.includes("db:")) return "database";
  if (s.startsWith("feat") || s.startsWith("add")) return "features";
  return "other";
}

function generateReleaseNotes(version) {
  const tag = lastTag();
  const raw = gitLogSince(tag || "HEAD~20");
  const sections = {
    features: [],
    bugFixes: [],
    performance: [],
    security: [],
    database: [],
    other: [],
  };

  for (const line of raw.split("\n").filter(Boolean)) {
    const [subject, hash, author] = line.split("|");
    const bucket = categorize(subject || "");
    const entry = `- ${subject} (${hash}, ${author})`;
    if (bucket === "other") sections.other.push(entry);
    else sections[bucket].push(entry);
  }

  const md = `# BuddyIntro v${version}

Released: ${new Date().toISOString().slice(0, 10)}

## Features
${sections.features.length ? sections.features.join("\n") : "- None"}

## Bug fixes
${sections.bugFixes.length ? sections.bugFixes.join("\n") : "- None"}

## Performance improvements
${sections.performance.length ? sections.performance.join("\n") : "- None"}

## Security improvements
${sections.security.length ? sections.security.join("\n") : "- None"}

## Database changes
${sections.database.length ? sections.database.join("\n") : "- None"}

## Deployment notes

- Node.js >= 18.17.0
- Run \`npx prisma migrate deploy\` after deploy
- Restart Passenger: \`touch tmp/restart.txt\`
- Verify: \`curl /api/health\`

## Other changes
${sections.other.length ? sections.other.join("\n") : "- None"}
`;

  const notesDir = join(ROOT, "deployment", "releases");
  if (!existsSync(notesDir)) mkdirSync(notesDir, { recursive: true });
  const notesPath = join(notesDir, `RELEASE_NOTES_v${version}.md`);
  writeFileSync(notesPath, md);
  return { md, notesPath };
}

module.exports = { generateReleaseNotes };
