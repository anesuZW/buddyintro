"use client";

import dynamic from "next/dynamic";
import { ServiceWorkerProvider } from "@/components/pwa/ServiceWorkerProvider";
import { UploadManagerProvider } from "@/components/uploads/UploadManagerProvider";

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
 * Single PWA shell: service worker lifecycle, update banner, offline indicator,
 * and background upload manager (survives authenticated navigation).
 * Install prompt lives in (main)/layout for authenticated routes only.
 */
export function PwaProviders({ children }: { children: React.ReactNode }) {
  return (
    <ServiceWorkerProvider>
      <UploadManagerProvider>
        {children}
        <UpdateManager />
        <OfflineDetector />
      </UploadManagerProvider>
    </ServiceWorkerProvider>
  );
}
