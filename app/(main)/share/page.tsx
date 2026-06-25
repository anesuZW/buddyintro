"use client";



import { useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { Suspense } from "react";

import { Button } from "@/components/ui/Button";

import { Textarea } from "@/components/ui/Input";

import { COPY } from "@/lib/copy";



function ShareDraftReview() {

  const router = useRouter();

  const params = useSearchParams();

  const [content, setContent] = useState("");

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

          const data = (await res.json()) as { draft: { content: string } | null };

          if (data.draft?.content) setContent(data.draft.content);

        }

      } finally {

        setLoading(false);

      }

    })();

  }, [params]);



  async function publish() {

    if (!content.trim()) return;

    setPublishing(true);

    try {

      const res = await fetch("/api/discoveries", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ content: content.trim(), visibility: "network" }),

      });

      if (res.ok) router.push("/discoveries");

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

      </p>

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

        <Button className="flex-1" disabled={publishing || !content.trim()} onClick={publish}>

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

