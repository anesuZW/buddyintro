/**
 * Remote build verification for deployment.
 */
const { remoteScript } = require("./resolve-server-node");

function buildCommand(appPath) {
  return remoteScript(appPath, ["npm run build"]);
}

function verifyBuildCommand(appPath) {
  return remoteScript(appPath, [
    'test -d .next || (echo "BUILD_MISSING: .next directory not found" && exit 1)',
    'test -f .next/BUILD_ID || (echo "BUILD_MISSING: .next/BUILD_ID not found" && exit 1)',
    'test -f build/version.json || (echo "BUILD_MISSING: build/version.json not found" && exit 1)',
    'echo "BUILD_VERIFIED"',
    "cat .next/BUILD_ID",
  ]);
}

function parseBuildVerifyOutput(output) {
  const text = (output || "").trim();
  if (text.includes("BUILD_MISSING")) {
    const line = text.split("\n").find((l) => l.includes("BUILD_MISSING")) || text;
    throw new Error(line.replace(/^BUILD_MISSING:\s*/, ""));
  }
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] || "";
}

function remoteBuildIdCheckCommand(appPath) {
  return remoteScript(appPath, [
    'test -f .next/BUILD_ID && cat .next/BUILD_ID || echo "BUILD_ID_MISSING"',
  ]);
}

module.exports = {
  buildCommand,
  verifyBuildCommand,
  parseBuildVerifyOutput,
  remoteBuildIdCheckCommand,
};
