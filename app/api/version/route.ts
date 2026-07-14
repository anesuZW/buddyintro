import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

type VersionManifest = {
  commit: string;
  branch: string;
  version: string;
  builtAt: string;
  node: string;
};

export async function GET() {
  const manifestPath = join(process.cwd(), "build", "version.json");

  if (!existsSync(manifestPath)) {
    return NextResponse.json(
      { error: "version manifest not found — run npm run build" },
      { status: 503 }
    );
  }

  let manifest: VersionManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as VersionManifest;
  } catch {
    return NextResponse.json({ error: "version manifest is invalid" }, { status: 503 });
  }

  return NextResponse.json({
    commit: manifest.commit,
    branch: manifest.branch,
    version: manifest.version,
    builtAt: manifest.builtAt,
    node: process.version,
    environment: process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV || "development",
  });
}
