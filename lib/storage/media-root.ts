import { isAbsolute, resolve } from "path";

const PRODUCTION_DEFAULT = "/home/buddyintro/shared/uploads";
const LEGACY_PRODUCTION_DEFAULT = "/home/buddyintro/uploads";
const DEVELOPMENT_DEFAULT = "./uploads";

const PRODUCTION_TEMPLATE_PREFIXES = ["/home/buddyintro/"];

function isProductionTemplatePath(raw: string): boolean {
  if (!raw) return false;
  if (raw === PRODUCTION_DEFAULT || raw === LEGACY_PRODUCTION_DEFAULT) return true;
  return PRODUCTION_TEMPLATE_PREFIXES.some((prefix) => raw.startsWith(prefix));
}

export function getNodeEnv(): string {
  return process.env.NODE_ENV?.trim() || "development";
}

export function isProductionEnv(nodeEnv = getNodeEnv()): boolean {
  return nodeEnv === "production";
}

export type ResolveMediaRootOptions = {
  cwd?: string;
  raw?: string;
  nodeEnv?: string;
};

/** Resolve MEDIA_ROOT for the active environment. */
export function resolveMediaRoot(options: ResolveMediaRootOptions = {}): string {
  const cwd = options.cwd ?? process.cwd();
  const nodeEnv = options.nodeEnv ?? getNodeEnv();
  const raw = (options.raw ?? process.env.MEDIA_ROOT?.trim()) || "";

  if (isProductionEnv(nodeEnv)) {
    const mediaPath = raw || PRODUCTION_DEFAULT;
    if (!isAbsolute(mediaPath)) {
      throw new Error("Production MEDIA_ROOT must be an absolute path");
    }
    return mediaPath;
  }

  if (!raw || isProductionTemplatePath(raw)) {
    return resolve(cwd, DEVELOPMENT_DEFAULT.replace(/^\.\//, ""));
  }

  if (isAbsolute(raw)) {
    return raw;
  }

  return resolve(cwd, raw);
}

/** Human-facing path for logs (keeps relative form in development when configured). */
export function getMediaRootDisplayPath(options: ResolveMediaRootOptions = {}): string {
  const raw = options.raw ?? process.env.MEDIA_ROOT?.trim();
  const nodeEnv = options.nodeEnv ?? getNodeEnv();

  if (!isProductionEnv(nodeEnv) && raw && !isAbsolute(raw) && !isProductionTemplatePath(raw)) {
    return raw;
  }

  if (!isProductionEnv(nodeEnv) && (!raw || isProductionTemplatePath(raw))) {
    return DEVELOPMENT_DEFAULT;
  }

  return resolveMediaRoot(options);
}

export function validateProductionMediaRoot(options: ResolveMediaRootOptions = {}): void {
  const nodeEnv = options.nodeEnv ?? getNodeEnv();
  if (!isProductionEnv(nodeEnv)) return;

  const raw = options.raw ?? process.env.MEDIA_ROOT?.trim();
  if (!raw) return;

  if (!isAbsolute(raw)) {
    throw new Error("Production MEDIA_ROOT must be an absolute path");
  }
}
