/**
 * Environment validation for deployment.
 */
const { loadEnvFiles } = require("./deploy-config");

const REQUIRED_SERVER_ENV = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "ADMIN_EMAILS",
];

const REQUIRED_LOCAL_DEPLOY = [
  "DEPLOY_SSH_HOST",
  "DEPLOY_SSH_USER",
  "DEPLOY_SSH_KEY",
];

function getMissingEnv(names) {
  loadEnvFiles();
  return names.filter((name) => !process.env[name] || !String(process.env[name]).trim());
}

function assertLocalDeployEnv() {
  const missing = getMissingEnv(REQUIRED_LOCAL_DEPLOY);
  if (missing.length) {
    throw new Error(
      `Missing required deployment env vars:\n  ${missing.join("\n  ")}\n` +
        "Set them in .env or .env.local (see .env.example)."
    );
  }
}

function assertServerEnvVarsPresent() {
  const missing = getMissingEnv(REQUIRED_SERVER_ENV);
  if (missing.length) {
    throw new Error(
      `Missing required application env vars (needed on server .env):\n  ${missing.join("\n  ")}`
    );
  }
}

/** Remote shell snippet: verify keys exist in .env without printing values. */
function remoteEnvCheckScript(keys) {
  const checks = keys.map((key) => `grep -q '^${key}=' .env`);
  return `test -f .env && ${checks.join(" && ")}`;
}

module.exports = {
  REQUIRED_SERVER_ENV,
  REQUIRED_LOCAL_DEPLOY,
  getMissingEnv,
  assertLocalDeployEnv,
  assertServerEnvVarsPresent,
  remoteEnvCheckScript,
};
