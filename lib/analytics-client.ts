"use client";

export async function trackClientEvent(args: {
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  } catch {
    /* non-blocking */
  }
}
