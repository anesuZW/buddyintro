"use client";

import { useState } from "react";
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
  const { upload, uploading } = useUpload();
  const router = useRouter();

  async function submit() {
    if (!content.trim() && !file) {
      toast.error("Add text or media");
      return;
    }
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
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setContent("");
      setFile(null);
      toast.success("Posted to your trusted network!");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not post");
    } finally {
      setPosting(false);
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
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-xs"
        />
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
