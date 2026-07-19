/** Pluggable job/queue layer — swap for Redis/BullMQ/RabbitMQ/SQS without changing callers. */

export type JobPayload = Record<string, unknown>;

export type EnqueueJobInput = {
  queue: string;
  jobType: string;
  payload: JobPayload;
  runAt?: Date;
  scheduledAt?: Date;
  maxAttempts?: number;
  priority?: JobPriority;
};

export interface QueueProvider {
  enqueue(input: EnqueueJobInput): Promise<string>;
}

export interface JobHandler {
  (payload: JobPayload): Promise<void>;
}

export interface JobProvider {
  register(jobType: string, handler: JobHandler): void;
  processNext(queue?: string): Promise<boolean>;
  processAllPending(limit?: number): Promise<number>;
}

export const JOB_TYPES = {
  NOTIFICATION_DELIVER: "notification.deliver",
  NOTIFICATION_DELIVERY: "notification.deliver",
  EMAIL_SEND: "email.send",
  EMAIL_DIGEST: "email.digest",
  PUSH_SEND: "push.send",
  TRUST_GRAPH_REBUILD: "trust_graph.rebuild",
  ANALYTICS_AGGREGATE: "analytics.aggregate",
  ANALYTICS_AGGREGATION: "analytics.aggregate",
  DISCOVERY_RANK: "discovery.rank",
  VERIFICATION_PROCESS: "verification.process",
  ADMIN_BROADCAST: "admin.broadcast",
  SECURITY_SCAN: "security.scan",
  MEDIA_PROCESS: "media.process",
  MEDIA_CLEANUP: "media.cleanup",
} as const;

export const QUEUES = {
  NOTIFICATIONS: "notifications",
  TRUST: "trust",
  ANALYTICS: "analytics",
  VERIFICATION: "verification",
  SECURITY: "security",
  MEDIA: "media",
} as const;

export type JobPriority = "low" | "normal" | "high" | "critical";
