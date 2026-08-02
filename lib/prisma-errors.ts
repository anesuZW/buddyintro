/** True when Prisma rejected a unique constraint (concurrent create race). */
export function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

const CONNECTIVITY_CODES = new Set([
  "P1000", // Authentication failed against database
  "P1001", // Can't reach database server
  "P1002", // Database server timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
]);

/** Pooler / network / timeout class of Prisma failures — retryable 503s. */
export function isPrismaConnectivityError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; name?: string; message?: string };
  if (e.code && CONNECTIVITY_CODES.has(e.code)) return true;
  if (e.name === "PrismaClientInitializationError") return true;
  const msg = (e.message || "").toLowerCase();
  return (
    msg.includes("can't reach database server") ||
    msg.includes("server has closed the connection") ||
    msg.includes("connection timed out") ||
    msg.includes("timed out fetching a new connection") ||
    msg.includes("too many connections")
  );
}
