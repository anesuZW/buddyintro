#!/usr/bin/env node
/** Sync uploads directory to remote server (rsync). */
const { loadEnvFiles, getDeployConfig } = require("./lib/deploy-config");
const { sshExecCapture } = require("./lib/ssh");
const { execSync } = require("child_process");
const { resolve } = require("path");

loadEnvFiles();

async function main() {
  const config = getDeployConfig();
  const localUploads = process.env.MEDIA_ROOT || resolve(process.cwd(), "uploads");
  const remoteUploads = `${config.appPath}/uploads`;

  console.log(`\n=== BuddyIntro Deploy Uploads ===\n`);
  console.log(`Local:  ${localUploads}`);
  console.log(`Remote: ${remoteUploads}`);

  await sshExecCapture(
    config,
    `mkdir -p ${JSON.stringify(remoteUploads)}`
  );

  const sshTarget = `${config.user}@${config.host}`;
  const port = config.port ? `-e "ssh -p ${config.port} -i ${config.keyPath}"` : "";
  const cmd = `rsync -avz --delete ${port} ${JSON.stringify(`${localUploads}/`)} ${sshTarget}:${JSON.stringify(`${remoteUploads}/`)}`;
  execSync(cmd, { stdio: "inherit", shell: true });
  console.log("\n✓ Uploads synced\n");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
