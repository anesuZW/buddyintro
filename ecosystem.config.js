const os = require("os");
const path = require("path");

/**
 * PM2 always launches the Next.js standalone bundle.
 * Workers run from the project root (scripts/, prisma/, full node_modules).
 *
 * PROJECT_ROOT defaults to this file's directory — works in repo checkout and
 * blue/green releases where ecosystem.config.js lives at the release root.
 */
const projectRoot = path.resolve(process.env.PROJECT_ROOT || __dirname);
const standaloneRoot = path.join(projectRoot, ".next", "standalone");
const serverJs = path.join(standaloneRoot, "server.js");

const cpuCount = os.cpus().length;
const instances = Math.max(1, Number(process.env.PM2_INSTANCES || cpuCount - 1));

function requireStandalone() {
  const fs = require("fs");
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Missing ${serverJs}. Run npm run build before pm2 start (standalone bundle not materialized).`
    );
  }
}

requireStandalone();

module.exports = {
  apps: [
    {
      name: "buddyintro",
      cwd: standaloneRoot,
      script: "server.js",
      instances,
      exec_mode: "cluster",
      autorestart: true,
      max_memory_restart: "750M",
      listen_timeout: 10000,
      kill_timeout: 10000,
      wait_ready: false,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
        PROJECT_ROOT: projectRoot,
      },
      error_file: path.join(projectRoot, "shared", "logs", "pm2-error.log"),
      out_file: path.join(projectRoot, "shared", "logs", "pm2-out.log"),
      merge_logs: true,
      time: true,
    },
    {
      name: "buddyintro-media-worker",
      cwd: projectRoot,
      script: path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      args: "scripts/media-worker.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PROJECT_ROOT: projectRoot,
      },
      error_file: path.join(projectRoot, "shared", "logs", "media-worker-error.log"),
      out_file: path.join(projectRoot, "shared", "logs", "media-worker-out.log"),
    },
    {
      name: "buddyintro-push-worker",
      cwd: projectRoot,
      script: path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      args: "scripts/push-worker.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        PROJECT_ROOT: projectRoot,
      },
      error_file: path.join(projectRoot, "shared", "logs", "push-worker-error.log"),
      out_file: path.join(projectRoot, "shared", "logs", "push-worker-out.log"),
    },
    {
      name: "buddyintro-job-worker",
      cwd: projectRoot,
      script: path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      args: "scripts/job-worker.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PROJECT_ROOT: projectRoot,
      },
      error_file: path.join(projectRoot, "shared", "logs", "job-worker-error.log"),
      out_file: path.join(projectRoot, "shared", "logs", "job-worker-out.log"),
    },
  ],
};
