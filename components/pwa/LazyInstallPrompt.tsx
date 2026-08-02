"use client";

import dynamic from "next/dynamic";

/** Deferred so main shell JS does not pay for install UI on first paint. */
export const LazyInstallPrompt = dynamic(
  () => import("@/components/pwa/InstallPrompt").then((m) => m.InstallPrompt),
  { ssr: false }
);
