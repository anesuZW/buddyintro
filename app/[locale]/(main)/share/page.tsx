"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { COPY } from "@/lib/copy";
import toast from "react-hot-toast";

type ShareDraft = {
  content: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  fileName?: string | null;
};

function ShareDraftReview() {
  const router = useRouter();
  const params = useSearchParams();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!params.get("draft")) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/share/draft");
        if (res.ok) {
          const data = (await res.json()) as { draft: ShareDraft | null };
          if (data.draft?.content) setContent(data.draft.content);
          if (data.draft?.mediaUrl) setMediaUrl(data.draft.mediaUrl);
          if (data.draft?.mediaType) setMediaType(data.draft.mediaType);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  async function publish() {
    if (!content.trim() && !mediaUrl) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/discoveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || null,
          mediaUrl,
          mediaType,
          visibility: "network",
        }),
      });
      if (res.ok) {
        router.push("/discoveries");
        return;
      }
      const err = await res.json().catch(() => ({}));
      toast.error((err as { error?: string }).error || "Could not publish");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading shared content…</div>;
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">Review shared content</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Content shared into {COPY.appName} becomes a Discoveries post in your trusted network.
        Prefer an introduction?{" "}
        <Link href="/create-story" className="text-primary underline">
          Create introduction
        </Link>
        .
      </p>

      {mediaUrl ? (
        <div className="mt-4 rounded-2xl overflow-hidden border border-border bg-muted aspect-video">
          {mediaType === "video" ? (
            <video src={mediaUrl} controls className="h-full w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="h-full w-full object-contain" />
          )}
        </div>
      ) : null}

      <Textarea
        className="mt-4"
        rows={6}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Edit before publishing…"
      />

      <div className="flex gap-2 mt-4">
        <Button variant="outline" className="flex-1" onClick={() => router.push("/discoveries")}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={publishing || (!content.trim() && !mediaUrl)}
          onClick={publish}
        >
          {publishing ? "Publishing…" : "Publish to Discoveries"}
        </Button>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading…</div>}>
      <ShareDraftReview />
    </Suspense>
  );
}
