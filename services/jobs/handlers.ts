import "server-only";



import { jobProvider } from "@/services/jobs/job-service";

import { JOB_TYPES, QUEUES } from "@/services/jobs/types";

import { notificationService } from "@/services/notifications/notification-service";

import type { CreateNotificationInput } from "@/services/notifications/types";

import { rebuildTrustGraph } from "@/lib/shared-introducers";

import { prisma } from "@/lib/prisma";

import { scanTrustRiskBatch } from "@/services/trust-abuse";

import { analyticsService } from "@/services/analytics/analytics-service";



let registered = false;



export function registerJobHandlers() {

  if (registered) return;

  registered = true;



  jobProvider.register(JOB_TYPES.NOTIFICATION_DELIVER, async (payload) => {

    await notificationService.create(payload as unknown as CreateNotificationInput);

  });



  jobProvider.register(JOB_TYPES.TRUST_GRAPH_REBUILD, async (payload) => {

    const userIds = (payload.userIds as string[] | undefined) ?? [];

    if (userIds.length) {

      const { refreshConnectionsForUsers } = await import(

        "@/services/introduction-graph-builder"

      );

      await refreshConnectionsForUsers(userIds);

      return;

    }

    await rebuildTrustGraph({ notifyForUserIds: [] });

  });



  jobProvider.register(JOB_TYPES.ADMIN_BROADCAST, async (payload) => {

    const users = await prisma.user.findMany({ select: { id: true } });

    await Promise.all(

      users.map((u) =>

        notificationService.create({

          userId: u.id,

          type: (payload.type as string) ?? "admin_announcement",

          title: String(payload.title ?? ""),

          message: String(payload.message ?? ""),

        })

      )

    );

  });



  jobProvider.register(JOB_TYPES.ANALYTICS_AGGREGATE, async () => {

    await analyticsService.queryMetrics({ days: 1 });

  });



  jobProvider.register(JOB_TYPES.EMAIL_DIGEST, async () => {

    // Placeholder for digest pipeline — keeps queue contract stable for BullMQ migration

    console.info("[jobs] email.digest processed (noop stub)");

  });



  jobProvider.register(JOB_TYPES.SECURITY_SCAN, async (payload) => {

    const limit = Number(payload.limit ?? 50);

    await scanTrustRiskBatch(limit);

  });

}



registerJobHandlers();



export { JOB_TYPES, QUEUES };


