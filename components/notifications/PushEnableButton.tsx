"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/branding";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushEnableButton() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window);
  }, []);

  async function enablePush() {
    setLoading(true);
    try {
      const keyRes = await fetch("/api/notifications/push");
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        toast.error("Push is not configured on this server");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Invalid subscription");
      }

      const res = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });

      if (!res.ok) throw new Error("Subscribe failed");
      setEnabled(true);
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
        await fetch(`/api/notifications/push?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
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
    <div className="pt-2 border-t border-border">
      <p className="text-xs text-muted-foreground mb-2">
        Receive trust-first alerts in your browser when {BRAND.name} is installed.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={enabled ? disablePush : enablePush}
      >
        {loading ? "Working…" : enabled ? "Disable browser push" : "Enable browser push"}
      </Button>
    </div>
  );
}
