"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useUpload } from "@/hooks/useUpload";

export function DiscoveriesComposer({
  userId,
  expiryHours,
}: {
  userId: string;
  expiryHours: number;
}) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const submitLock = useRef(false);
  const { upload, uploading, progress, cancel } = useUpload();
  const router = useRouter();

  async function submit() {
    if (submitLock.current) return;
    if (!content.trim() && !file) {
      toast.error("Add text or media");
      return;
    }
    submitLock.current = true;
    setPosting(true);
    try {
      let mediaUrl: string | undefined;
      let mediaType: "image" | "video" | undefined;
      if (file) {
        const kind = file.type.startsWith("video/") ? "video" : "image";
        const { url } = await upload(file, { userId, kind });
        mediaUrl = url;
        mediaType = kind;
      }
      const res = await fetch("/api/discoveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || null,
          mediaUrl: mediaUrl ?? null,
          mediaType: mediaType ?? null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          reason?: string;
        };
        if (body.code === "csrf_rejected") {
          throw new Error(
            "Could not post — refresh the page and try again (session origin mismatch)."
          );
        }
        if (res.status === 503 || body.code === "service_unavailable") {
          throw new Error(
            body.reason ||
              "BuddyIntro is temporarily unavailable. Please retry in a moment."
          );
        }
        throw new Error(body.reason || body.error || "Failed");
      }
      setContent("");
      setFile(null);
      toast.success("Posted to your trusted network!");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast("Upload cancelled");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not post");
    } finally {
      setPosting(false);
      submitLock.current = false;
    }
  }

  return (
    <div className="card p-4 mx-4 mt-4 space-y-3 border-primary/10">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Clock size={14} className="text-primary mt-0.5 shrink-0" />
        <span>Posts disappear automatically after {expiryHours} hours.</span>
      </div>
      <Textarea
        rows={2}
        placeholder="Share something with your trusted network…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-xs"
          disabled={posting || uploading}
        />
        {uploading ? (
          <>
            <span className="text-xs text-muted-foreground">Uploading… {progress}%</span>
            <Button type="button" variant="ghost" className="h-10" onClick={cancel}>
              Cancel
            </Button>
          </>
        ) : null}
        <Button
          className="ml-auto h-10"
          disabled={posting || uploading}
          onClick={submit}
        >
          {posting || uploading ? "Posting…" : "Post"}
        </Button>
      </div>
    </div>
  );
}
