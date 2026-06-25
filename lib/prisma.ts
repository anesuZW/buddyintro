import { PrismaClient } from "@prisma/client";
import { trackPrismaQuery } from "@/lib/perf/context";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Query timing extension — feeds /maindash/performance and slow-query logs (>200ms).
  return base.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const t0 = performance.now();
        const result = await query(args);
        const durationMs = Math.round(performance.now() - t0);
        trackPrismaQuery(model ?? "raw", operation, durationMs);
        if (durationMs > 200 && process.env.NODE_ENV === "development") {
          console.warn(`[prisma:slow] ${model}.${operation} ${durationMs}ms`);
        }
        return result;
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
