"use client";

import { ServiceWorkerProvider } from "@/components/pwa/ServiceWorkerProvider";
import { UpdateManager } from "@/components/pwa/UpdateManager";
import { OfflineDetector } from "@/components/pwa/OfflineDetector";

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
