/** Safety caps for user_connections hot paths (1000-user dataset). */
export const USER_CONNECTION_LIMITS = {
  /** Max network IDs loaded for discoveries feed IN clause */
  networkIds: 2500,
  /** Max rows per degree listing in UI */
  perDegree: 500,
  /** Batch size for background trust score refresh */
  trustRefreshBatch: 500,
} as const;
