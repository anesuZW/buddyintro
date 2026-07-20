import { z } from "zod";
import { isValidPushEndpoint } from "@/lib/pwa/push-payload";

export const PushSubscribeSchema = z.object({
  endpoint: z.string().url().refine(isValidPushEndpoint, "Invalid push endpoint"),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
  expirationTime: z.number().nullable().optional(),
  deviceType: z.string().max(32).optional(),
  browser: z.string().max(64).optional(),
  platform: z.string().max(64).optional(),
});

export const PushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const PushSendSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  url: z.string().max(512).optional(),
  type: z.string().max(64).optional(),
});

export type PushSubscribeInput = z.infer<typeof PushSubscribeSchema>;
