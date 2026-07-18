import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

type VersionManifest = {
  commit: string;
  branch: string;
  version: string;
  builtAt: string;
  node: string;
  deploymentId?: string;
  nextVersion?: string;
  prismaVersion?: string;
};

type BuildJson = {
  version: string;
  gitCommit: string;
  gitBranch: string;
  buildDate: string;
  nodeVersion: string;
  nextVersion?: string;
  prismaVersion?: string;
  deploymentId?: string;
};

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function loadManifest(): VersionManifest | null {
  const cwd = process.cwd();
  const buildJson =
    readJson<BuildJson>(join(cwd, "deployment", "build.json")) ||
    readJson<BuildJson>(join(cwd, "build", "build.json"));
  if (buildJson) {
    return {
      commit: buildJson.gitCommit,
      branch: buildJson.gitBranch,
      version: buildJson.version,
      builtAt: buildJson.buildDate,
      node: buildJson.nodeVersion,
      deploymentId: buildJson.deploymentId,
      nextVersion: buildJson.nextVersion,
      prismaVersion: buildJson.prismaVersion,
    };
  }
  return readJson<VersionManifest>(join(cwd, "build", "version.json"));
}

export async function GET() {
  const manifest = loadManifest();

  if (!manifest) {
    return NextResponse.json(
      { error: "version manifest not found — run npm run build" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    commit: manifest.commit,
    branch: manifest.branch,
    version: manifest.version,
    builtAt: manifest.builtAt,
    node: process.version,
    environment: process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV || "development",
    deploymentId: manifest.deploymentId,
    nextVersion: manifest.nextVersion,
    prismaVersion: manifest.prismaVersion,
  });
}
