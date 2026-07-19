/**
 * Cross-platform shared directory/file links for blue/green deploy.
 * Windows uses directory junctions; Linux uses symlinks.
 */
const {
  existsSync,
  lstatSync,
  symlinkSync,
  unlinkSync,
  rmSync,
  readlinkSync,
  linkSync,
  copyFileSync,
} = require("fs");
const path = require("path");

function isWindows() {
  return process.platform === "win32";
}

function resolvePath(value) {
  return path.resolve(value);
}

function isLinkEntry(entryPath) {
  try {
    return lstatSync(entryPath).isSymbolicLink();
  } catch {
    return false;
  }
}

function readLinkTarget(entryPath) {
  const raw = readlinkSync(entryPath);
  return path.resolve(path.dirname(entryPath), raw);
}

function safeRemoveLink(target, options = {}) {
  const resolvedTarget = resolvePath(target);
  const protectPaths = (options.protectPaths || []).map(resolvePath);

  for (const protectedPath of protectPaths) {
    if (resolvedTarget === protectedPath) {
      throw new Error(`Refusing to remove protected shared path: ${resolvedTarget}`);
    }
  }

  if (!existsSync(resolvedTarget)) return;

  if (isLinkEntry(resolvedTarget)) {
    unlinkSync(resolvedTarget);
    return;
  }

  const stat = lstatSync(resolvedTarget);
  if (stat.isDirectory()) {
    rmSync(resolvedTarget, { recursive: true, force: true });
    return;
  }

  unlinkSync(resolvedTarget);
}

function validateSharedLink(source, target, options = {}) {
  const resolvedSource = resolvePath(source);
  const resolvedTarget = resolvePath(target);
  const mode = options.mode || "symlink";

  if (!existsSync(resolvedTarget)) {
    throw new Error(
      `Shared link validation failed:\nsource: ${resolvedSource}\ntarget: ${resolvedTarget}`
    );
  }

  if (mode === "hardlink" || mode === "copy") {
    if (!existsSync(resolvedSource)) {
      throw new Error(
        `Shared link validation failed:\nsource: ${resolvedSource}\ntarget: ${resolvedTarget}`
      );
    }
    return;
  }

  if (!isLinkEntry(resolvedTarget)) {
    throw new Error(
      `Shared link validation failed:\nsource: ${resolvedSource}\ntarget: ${resolvedTarget}`
    );
  }

  const actual = readLinkTarget(resolvedTarget);
  if (actual !== resolvedSource) {
    throw new Error(
      `Shared link validation failed:\nsource: ${resolvedSource}\ntarget: ${resolvedTarget}`
    );
  }
}

function createSharedLink(source, target, options = {}) {
  const type = options.type || "dir";
  const resolvedSource = resolvePath(source);
  const resolvedTarget = resolvePath(target);
  const protectPaths = options.protectPaths || [];
  let linkMode = "symlink";

  if (!existsSync(resolvedSource)) {
    throw new Error(`Shared link source does not exist: ${resolvedSource}`);
  }

  safeRemoveLink(resolvedTarget, { protectPaths });

  if (isWindows()) {
    if (type === "file") {
      try {
        symlinkSync(resolvedSource, resolvedTarget, "file");
      } catch (err) {
        if (err.code !== "EPERM" && err.code !== "ENOTSUP") throw err;
        try {
          linkSync(resolvedSource, resolvedTarget);
          linkMode = "hardlink";
        } catch {
          copyFileSync(resolvedSource, resolvedTarget);
          linkMode = "copy";
        }
      }
    } else {
      symlinkSync(resolvedSource, resolvedTarget, "junction");
    }
  } else {
    symlinkSync(resolvedSource, resolvedTarget, type === "file" ? "file" : "dir");
  }

  validateSharedLink(resolvedSource, resolvedTarget, { mode: linkMode });
}

module.exports = {
  createSharedLink,
  validateSharedLink,
  safeRemoveLink,
  isWindows,
};
