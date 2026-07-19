import "server-only";

import type { Logger } from "pino";
import { getRequestContext } from "@/lib/request-context";

let logger: Logger | null = null;

function getLogger(): Logger {
  if (logger) return logger;

  // Lazy require keeps pino/stream out of module evaluation during Next builds.
  const pino = require("pino") as typeof import("pino");
  const isDev = process.env.NODE_ENV !== "production";

  logger = pino({
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
    base: {
      service: "buddyintro",
      env: process.env.NODE_ENV || "development",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
  });

  return logger;
}

export type LogFields = {
  requestId?: string;
  userId?: string;
  route?: string;
  durationMs?: number;
  err?: unknown;
  [key: string]: unknown;
};

/** Structured log with request context merged automatically. */
export function log(level: "info" | "warn" | "error" | "debug", message: string, fields: LogFields = {}) {
  const ctx = getRequestContext();
  const payload = {
    requestId: fields.requestId ?? ctx?.requestId,
    userId: fields.userId ?? ctx?.userId,
    route: fields.route ?? ctx?.route,
    durationMs: fields.durationMs ?? ctx?.durationMs,
    ...fields,
  };
  getLogger()[level](payload, message);
}

export const appLogger = {
  info: (message: string, fields?: LogFields) => log("info", message, fields),
  warn: (message: string, fields?: LogFields) => log("warn", message, fields),
  error: (message: string, fields?: LogFields) => log("error", message, fields),
  debug: (message: string, fields?: LogFields) => log("debug", message, fields),
};
