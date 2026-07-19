import { readFileSync, existsSync } from "fs";
import { join } from "path";

export type DeploymentBuildInfo = {
  version: string;
  gitCommit: string;
  gitBranch: string;
  buildDate: string;
  nodeVersion: string;
  nextVersion?: string;
  prismaVersion?: string;
  deploymentId?: string;
};

export function readDeploymentBuildInfo(cwd = process.cwd()): DeploymentBuildInfo | null {
  const paths = [
    join(cwd, "deployment", "build.json"),
    join(cwd, "build", "build.json"),
    join(cwd, "build", "version.json"),
  ];

  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
      if (raw.gitCommit) {
        return {
          version: raw.version || "0.0.0",
          gitCommit: raw.gitCommit,
          gitBranch: raw.gitBranch || "unknown",
          buildDate: raw.buildDate || raw.builtAt || "",
          nodeVersion: raw.nodeVersion || raw.node || "",
          nextVersion: raw.nextVersion,
          prismaVersion: raw.prismaVersion,
          deploymentId: raw.deploymentId,
        };
      }
      if (raw.commit) {
        return {
          version: raw.version || "0.0.0",
          gitCommit: raw.commit,
          gitBranch: raw.branch || "unknown",
          buildDate: raw.builtAt || "",
          nodeVersion: raw.node || "",
          deploymentId: raw.deploymentId,
          nextVersion: raw.nextVersion,
          prismaVersion: raw.prismaVersion,
        };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}
