import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";

import { listIntroductionCategories } from "@/services/introduction-categories";

import { Phase2Profiler, runWithPhase2Profile } from "@/lib/profile/phase2-profiler";



async function handleGet() {

  return runWithPhase2Profile("/api/introduction-categories", async () => {

    const p = new Phase2Profiler("/api/introduction-categories");



    await p.timeRouteAuth(() => requireUser());



    const categories = await p.time("listCategories", () =>

      listIntroductionCategories(true)

    );



    const payload = { categories };

    await p.time("serialize", async () => JSON.stringify(payload));



    const responseStart = performance.now();

    const res = NextResponse.json(payload, {

      headers: {

        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",

      },

    });

    const responseMs = Math.round(performance.now() - responseStart);



    p.log({ response: responseMs });

    return res;

  });

}



export const GET = handleGet;


