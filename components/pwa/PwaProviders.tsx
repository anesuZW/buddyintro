"use client";

import dynamic from "next/dynamic";
import { ServiceWorkerProvider } from "@/components/pwa/ServiceWorkerProvider";

const UpdateManager = dynamic(
  () => import("@/components/pwa/UpdateManager").then((m) => m.UpdateManager),
  { ssr: false }
);
const OfflineDetector = dynamic(
  () =>
    import("@/components/pwa/OfflineDetector").then((m) => m.OfflineDetector),
  { ssr: false }
);

/**
 * Single PWA shell: service worker lifecycle, update banner, offline indicator.
 * Install prompt lives in (main)/layout for authenticated routes only.
 */
export function PwaProviders({ children }: { children: React.ReactNode }) {
  return (
    <ServiceWorkerProvider>
      {children}
      <UpdateManager />
      <OfflineDetector />
    </ServiceWorkerProvider>
  );
}
