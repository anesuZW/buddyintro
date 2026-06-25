import { NextResponse } from "next/server";

import { cookies } from "next/headers";



/** Web Share Target handler — stores draft discovery in cookie for review. */

export async function POST(request: Request) {

  const form = await request.formData();

  const title = String(form.get("title") ?? "");

  const text = String(form.get("text") ?? "");

  const url = String(form.get("url") ?? "");

  const file = form.get("media");



  let mediaHint: string | null = null;

  if (file instanceof File && file.size > 0) {

    mediaHint = `[Shared ${file.type || "file"}: ${file.name}]`;

  }



  const content = [title, text, url, mediaHint].filter(Boolean).join("\n\n");



  cookies().set("fi-share-draft", JSON.stringify({ content, at: Date.now() }), {

    httpOnly: true,

    sameSite: "lax",

    maxAge: 3600,

    path: "/",

  });



  return NextResponse.redirect(new URL("/share?draft=1", request.url), 303);

}

