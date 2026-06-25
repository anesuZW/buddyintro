import { NextResponse } from "next/server";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";

import { notificationService } from "@/services/notifications/notification-service";

import { Phase2Profiler, runWithPhase2Profile } from "@/lib/profile/phase2-profiler";



export async function GET() {

  return runWithPhase2Profile("/api/notifications/preferences", async () => {

    const p = new Phase2Profiler("/api/notifications/preferences");



    const user = await p.timeRouteAuth(async () => {

      const u = await getCurrentUser();

      if (!u) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

      return u;

    });



    const preferences = await p.time("queryPreferences", () =>

      notificationService.getPreferences(user.id)

    );



    const payload = { preferences };

    await p.time("serialize", async () => JSON.stringify(payload));



    const responseStart = performance.now();

    const res = NextResponse.json(payload);

    const responseMs = Math.round(performance.now() - responseStart);



    p.log({ response: responseMs, readPath: 1 });

    return res;

  });

}



const Schema = z.object({

  enableNotifications: z.boolean().optional(),

  enableIntroductionNotifications: z.boolean().optional(),

  enableInvitationNotifications: z.boolean().optional(),

  enableDiscoveryNotifications: z.boolean().optional(),

  enableMessageNotifications: z.boolean().optional(),

  enableTrustNotifications: z.boolean().optional(),

  enableVerificationNotifications: z.boolean().optional(),

  enableEmailNotifications: z.boolean().optional(),

  enablePushNotifications: z.boolean().optional(),

  enableInAppNotifications: z.boolean().optional(),

  quietHoursEnabled: z.boolean().optional(),

  quietHoursStart: z.string().nullable().optional(),

  quietHoursEnd: z.string().nullable().optional(),

});



export async function PATCH(request: Request) {

  const user = await getCurrentUser();

  if (!user) {

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  }

  const data = Schema.parse(await request.json());

  const preferences = await notificationService.updatePreferences(user.id, data);

  return NextResponse.json({ preferences });

}


