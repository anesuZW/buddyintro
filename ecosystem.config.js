const os = require("os");
const { resolve } = require("path");

const cpuCount = os.cpus().length;
const instances = Math.max(1, Number(process.env.PM2_INSTANCES || cpuCount - 1));
const appRoot = process.env.APP_ROOT || process.cwd();

module.exports = {
  apps: [
    {
      name: "buddyintro",
      cwd: resolve(appRoot),
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
      },
      error_file: resolve(appRoot, "../shared/logs/pm2-error.log"),
      out_file: resolve(appRoot, "../shared/logs/pm2-out.log"),
      merge_logs: true,
      time: true,
    },
    {
      name: "buddyintro-media-worker",
      cwd: resolve(appRoot),
      script: "node_modules/tsx/dist/cli.mjs",
      args: "scripts/media-worker.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
      error_file: resolve(appRoot, "../shared/logs/media-worker-error.log"),
      out_file: resolve(appRoot, "../shared/logs/media-worker-out.log"),
    },
    {
      name: "buddyintro-job-worker",
      cwd: resolve(appRoot),
      script: "node_modules/tsx/dist/cli.mjs",
      args: "scripts/job-worker.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
      error_file: resolve(appRoot, "../shared/logs/job-worker-error.log"),
      out_file: resolve(appRoot, "../shared/logs/job-worker-out.log"),
    },
  ],
};
