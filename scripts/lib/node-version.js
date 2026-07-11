/**
 * Node.js version comparison helpers.
 */
function parseNodeVersion(raw) {
  const m = String(raw || "")
    .trim()
    .replace(/^v/, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compareVersions(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function satisfiesMinVersion(raw, min = "18.17.0") {
  const current = parseNodeVersion(raw);
  const required = parseNodeVersion(min);
  if (!current || !required) return false;
  return compareVersions(current, required) >= 0;
}

module.exports = { parseNodeVersion, satisfiesMinVersion, compareVersions };
