/**
 * Nightly incremental upload backup to S3-compatible storage.
 * Usage: npm run media:backup
 */
import fs from "fs";
import { readdir, readFile, stat } from "fs/promises";
import { join, relative, resolve } from "path";
import { getMediaBackupProvider, getMediaRoot, getS3CompatibleConfig } from "@/lib/storage/config";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

async function walkFiles(root: string, dir = root): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(root, absolute)));
    else if (entry.isFile()) files.push(relative(root, absolute).replace(/\\/g, "/"));
  }
  return files;
}

async function main() {
  const provider = getMediaBackupProvider();
  if (provider === "none") {
    console.info("[media-backup] MEDIA_BACKUP_PROVIDER=none — skipping");
    return;
  }

  const configName = provider === "backblaze" ? "backblaze" : "cloudflare-r2";
  const config = getS3CompatibleConfig(configName);
  const { S3Client, PutObjectCommand, HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: config.region || "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: Boolean(config.endpoint),
  });

  const root = resolve(getMediaRoot());
  const files = await walkFiles(root);
  let uploaded = 0;
  let skipped = 0;

  for (const key of files) {
    const absolute = join(root, key);
    const fileStat = await stat(absolute);
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
      const remoteTime = head.LastModified ? head.LastModified.getTime() : 0;
      if (remoteTime >= fileStat.mtimeMs) {
        skipped++;
        continue;
      }
    } catch {
      /* missing remote object */
    }

    const body = await readFile(absolute);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    uploaded++;
  }

  console.info(`[media-backup] uploaded=${uploaded} skipped=${skipped} total=${files.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
