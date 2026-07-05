/**
 * BuddyIntro — cPanel Passenger production entry point.
 *
 * Passenger sets PORT automatically. Do not hardcode.
 * Run `npm run build` before deploying this file with `.next/`.
 */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

if (dev) {
  console.warn("[buddyintro] NODE_ENV is not production — use `npm run dev` for local development.");
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let ready = false;
let bootError = null;

app
  .prepare()
  .then(() => {
    ready = true;
    console.log(`[buddyintro] Next.js ready on port ${port} (${dev ? "dev" : "production"})`);
  })
  .catch((err) => {
    bootError = err;
    console.error("[buddyintro] Failed to prepare Next.js:", err);
    process.exit(1);
  });

module.exports = function passengerApp(req, res) {
  if (bootError) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Application failed to start", status: "unhealthy" }));
    return;
  }

  if (!ready) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Application starting", status: "starting" }));
    return;
  }

  try {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  } catch (err) {
    console.error("[buddyintro] Request handler error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }
};

// Standalone mode (non-Passenger): `node index.js`
if (require.main === module) {
  app.prepare().then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, hostname, () => {
      console.log(`[buddyintro] Listening on http://${hostname}:${port}`);
    });
  });
}
