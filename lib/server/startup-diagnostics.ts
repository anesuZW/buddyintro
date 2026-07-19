import "server-only";

import {
  runStartupDiagnostics,
  type StartupDiagnostic,
} from "@/lib/diagnostics/startup-check";

export type { StartupDiagnostic };
export { runStartupDiagnostics };

export async function logStartupDiagnostics(): Promise<void> {
  const { appLogger } = await import("@/lib/logger");
  const diagnostics = await runStartupDiagnostics();
  for (const item of diagnostics) {
    const level = item.status === "error" ? "error" : item.status === "warn" ? "warn" : "info";
    appLogger[level]("startup diagnostic", { route: "startup", ...item });
  }
  const failed = diagnostics.filter((d) => d.status === "error");
  if (failed.length && process.env.NODE_ENV === "production") {
    throw new Error(`Startup failed: ${failed.map((f) => f.name).join(", ")}`);
  }
}
