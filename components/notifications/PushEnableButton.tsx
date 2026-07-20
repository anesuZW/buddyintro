"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/branding";
import { parseDeviceMeta, trackPwaEvent, urlBase64ToUint8Array, PWA_ANALYTICS } from "@/lib/pwa/client";

export function PushEnableButton() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window);

    async function checkExisting() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setEnabled(Boolean(sub));
      } catch {
        setEnabled(false);
      }
    }

    void checkExisting();
  }, []);

  async function enablePush() {
    setLoading(true);
    try {
      const keyRes = await fetch("/api/push/subscribe");
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        toast.error("Push is not configured on this server");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        void trackPwaEvent(PWA_ANALYTICS.NOTIFICATION_DENIED);
        toast.error("Notification permission denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Invalid subscription");
      }

      const meta = parseDeviceMeta();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          expirationTime: json.expirationTime ?? null,
          ...meta,
        }),
      });

      if (!res.ok) throw new Error("Subscribe failed");
      setEnabled(true);
      void trackPwaEvent(PWA_ANALYTICS.NOTIFICATION_ENABLED);
      toast.success("Push notifications enabled");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not enable push");
    } finally {
      setLoading(false);
    }
  }

  async function disablePush() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
      toast.success("Push notifications disabled");
    } catch {
      toast.error("Could not disable push");
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="pt-2 border-t border-border space-y-2">
      <p className="text-xs text-muted-foreground">
        Receive trust-first alerts in your browser when {BRAND.name} is installed.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={enabled ? disablePush : enablePush}
        >
          {loading ? "Working…" : enabled ? "Disable browser push" : "Enable browser push"}
        </Button>
        {enabled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await fetch("/api/push/test", { method: "POST" });
                toast.success("Test notification sent");
              } catch {
                toast.error("Test failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            Send test
          </Button>
        ) : null}
      </div>
    </div>
  );
}
