import { access, mkdir } from "fs/promises";
import { constants } from "fs";
import {
  getMediaRootDisplayPath,
  isProductionEnv,
  resolveMediaRoot,
  type ResolveMediaRootOptions,
} from "@/lib/storage/media-root";

export type StorageCheckResult = {
  ok: boolean;
  path: string;
  displayPath: string;
  messages: string[];
};

export async function ensureLocalStorageReady(
  options: ResolveMediaRootOptions = {}
): Promise<StorageCheckResult> {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const displayPath = getMediaRootDisplayPath(options);
  const resolvedPath = resolveMediaRoot(options);
  const messages: string[] = [];

  try {
    await access(resolvedPath, constants.R_OK | constants.W_OK);
    messages.push(`✓ Storage ready`);
    messages.push(`✓ Storage root: ${resolvedPath}`);
    return { ok: true, path: resolvedPath, displayPath, messages };
  } catch {
    if (isProductionEnv(nodeEnv)) {
      messages.push("ERROR:");
      messages.push("Production media storage missing.");
      messages.push("");
      messages.push("Create:");
      messages.push("");
      messages.push(`mkdir -p ${resolvedPath}`);
      return { ok: false, path: resolvedPath, displayPath, messages };
    }

    messages.push("Creating development storage:");
    messages.push(displayPath);
    await mkdir(resolvedPath, { recursive: true });
    messages.push("");
    messages.push("✓ Storage ready");
    messages.push(`✓ Storage root: ${resolvedPath}`);
    return { ok: true, path: resolvedPath, displayPath, messages, created: true } as StorageCheckResult & {
      created?: boolean;
    };
  }
}
