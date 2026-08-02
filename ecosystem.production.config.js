/**
 * BuddyIntro — production PM2 ecosystem (InterServer VPS / standalone).
 *
 * Usage:
 *   npm run build
 *   pm2 start ecosystem.production.config.js
 *   pm2 save
 *
 * Requires PROJECT_ROOT (defaults to this file's directory) and a synced
 * `.next/standalone` bundle from `npm run build`.
 */
const os = require("os");
const path = require("path");

const projectRoot = path.resolve(process.env.PROJECT_ROOT || __dirname);
const standaloneRoot = path.join(projectRoot, ".next", "standalone");
const serverJs = path.join(standaloneRoot, "server.js");
const logDir = path.join(projectRoot, "shared", "logs");

const cpuCount = os.cpus().length;
const instances = Math.max(
  1,
  Math.min(Number(process.env.PM2_INSTANCES || Math.max(1, cpuCount - 1)), cpuCount)
);

function requireStandalone() {
  const fs = require("fs");
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Missing ${serverJs}. Run npm run build before pm2 start (standalone bundle not materialized).`
    );
  }
}

requireStandalone();

const sharedEnv = {
  NODE_ENV: "production",
  PROJECT_ROOT: projectRoot,
  PORT: process.env.PORT || 3000,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};

module.exports = {
  apps: [
    {
      name: "buddyintro",
      cwd: standaloneRoot,
      script: "server.js",
      instances,
      exec_mode: "cluster",
      autorestart: true,
      max_restarts: 15,
      min_uptime: "10s",
      max_memory_restart: "750M",
      listen_timeout: 10000,
      kill_timeout: 10000,
      wait_ready: false,
      merge_logs: true,
      time: true,
      env: sharedEnv,
      error_file: path.join(logDir, "pm2-buddyintro-error.log"),
      out_file: path.join(logDir, "pm2-buddyintro-out.log"),
    },
    {
      name: "buddyintro-media-worker",
      cwd: projectRoot,
      script: path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      args: "scripts/media-worker.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "5s",
      max_memory_restart: "512M",
      env: sharedEnv,
      error_file: path.join(logDir, "media-worker-error.log"),
      out_file: path.join(logDir, "media-worker-out.log"),
    },
    {
      name: "buddyintro-push-worker",
      cwd: projectRoot,
      script: path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      args: "scripts/push-worker.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "5s",
      max_memory_restart: "256M",
      env: sharedEnv,
      error_file: path.join(logDir, "push-worker-error.log"),
      out_file: path.join(logDir, "push-worker-out.log"),
    },
    {
      name: "buddyintro-job-worker",
      cwd: projectRoot,
      script: path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      args: "scripts/job-worker.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "5s",
      max_memory_restart: "256M",
      env: sharedEnv,
      error_file: path.join(logDir, "job-worker-error.log"),
      out_file: path.join(logDir, "job-worker-out.log"),
    },
  ],
};
