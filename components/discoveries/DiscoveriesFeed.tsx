"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Bookmark,
  Heart,
  Mail,
  MessageCircle,
  Share2,
  Send,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { timeAgo, cn } from "@/lib/utils";
import type { DiscoveriesPostWithMeta } from "@/types";
import { SharedIntroducersPanel } from "@/components/trust/SharedIntroducersPanel";
import { TrustedUserBadge } from "@/components/trust/TrustedUserBadge";
import { TrustRankBadge } from "@/components/trust/TrustRankBadge";
import { DiscoveryTrustExplanation } from "@/components/discoveries/DiscoveryTrustExplanation";
import { DiscoveryTrustContext } from "@/components/discoveries/DiscoveryTrustContext";
import { DiscoveryExpiryBadge } from "@/components/discoveries/DiscoveryExpiryBadge";
import { DiscoveriesHeroBanner } from "@/components/discoveries/DiscoveriesHeroBanner";
import { DiscoveriesEmptyState } from "@/components/discoveries/DiscoveriesEmptyState";
import { TrustNetworkModal } from "@/components/trust/TrustNetworkModal";
import { ListError, ListLoading } from "@/components/ui/ListState";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { BRAND } from "@/lib/branding";
import type { DiscoveriesUxSettings } from "@/lib/discoveries-ux-settings";

function trackDiscoveryOpened(postId: string) {
  void fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: ANALYTICS_EVENTS.DISCOVERY_OPENED,
      entityType: "discoveries_post",
      entityId: postId,
    }),
  }).catch(() => {});
}

function DiscoveriesPostCard({
  post,
  onUpdate,
  showExpiryIndicators,
  showTrustContext,
}: {
  post: DiscoveriesPostWithMeta;
  onUpdate: (p: DiscoveriesPostWithMeta) => void;
  showExpiryIndicators: boolean;
  showTrustContext: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<
    Array<{ id: string; content: string; user: { name: string; profilePicture: string | null } }>
  >([]);
  const [commentText, setCommentText] = useState("");
  const [liking, setLiking] = useState(false);
  const [showTrustModal, setShowTrustModal] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const openedTracked = useRef(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || openedTracked.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !openedTracked.current) {
          openedTracked.current = true;
          trackDiscoveryOpened(post.id);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [post.id]);

  async function toggleLike() {
    setLiking(true);
    try {
      const res = await fetch(`/api/discoveries/${post.id}/like`, {
        method: post.likedByMe ? "DELETE" : "POST",
      });
      const data = await res.json();
      onUpdate({
        ...post,
        likedByMe: data.liked,
        likeCount: post.likeCount + (data.liked ? 1 : -1),
      });
    } finally {
      setLiking(false);
    }
  }

  async function toggleBookmark() {
    const res = await fetch(`/api/discoveries/${post.id}/bookmark`, { method: "POST" });
    const data = await res.json();
    onUpdate({ ...post, bookmarkedByMe: data.bookmarked });
  }

  async function sharePost() {
    await fetch(`/api/discoveries/${post.id}/share`, { method: "POST" });
    const url = `${window.location.origin}/discoveries?post=${post.id}`;
    if (navigator.share) {
      await navigator.share({ title: BRAND.name, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
    onUpdate({ ...post, shareCount: post.shareCount + 1 });
  }

  async function loadComments() {
    const res = await fetch(`/api/discoveries/${post.id}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const res = await fetch(`/api/discoveries/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText.trim() }),
    });
    if (res.ok) {
      setCommentText("");
      await loadComments();
      onUpdate({ ...post, commentCount: post.commentCount + 1 });
    }
  }

  return (
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden border-primary/10 bg-fi-card"
    >
      <div className="flex items-center gap-3 p-4 pb-2">
        <Avatar src={post.user.profilePicture} name={post.user.name} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/profile/${post.user.id}`} className="font-semibold text-sm hover:underline">
              {post.user.name}
            </Link>
            {showExpiryIndicators && (
              <DiscoveryExpiryBadge expiresAt={post.expiresAt} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            <TrustedUserBadge
              trustedUser={post.trustProfile?.verification?.trustedUser}
              verificationLevel={undefined}
              compact
            />
            <TrustRankBadge tier={post.trustProfile?.trustRankTier} compact />
          </div>
          <div className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</div>
          {showTrustContext ? (
            <DiscoveryTrustContext
              connectionReason={post.connectionReason}
              trustProfile={post.trustProfile}
            />
          ) : (
            <DiscoveryTrustExplanation
              authorUserId={post.user.id}
              trustProfile={post.trustProfile}
              connectionDepth={post.connectionReason?.connectionDepth}
              categoryName={
                post.connectionReason?.label?.includes("network")
                  ? post.connectionReason.label
                  : undefined
              }
            />
          )}
        </div>
        <Link href={`/messages/${post.user.id}?from=discoveries&post=${post.id}`}>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
            <Mail size={14} />
            Message
          </Button>
        </Link>
      </div>

      {post.trustProfile && post.trustProfile.sharedIntroducerCount >= 0 && (
        <div className="px-4 pb-2">
          <SharedIntroducersPanel
            trustProfile={post.trustProfile}
            compact
            onViewAll={() => setShowTrustModal(true)}
          />
        </div>
      )}

      {showTrustModal && post.trustProfile && (
        <TrustNetworkModal
          trustProfile={post.trustProfile}
          otherName={post.user.name}
          onClose={() => setShowTrustModal(false)}
        />
      )}

      {post.mediaUrl && (
        <div className="bg-black">
          {post.mediaType === "video" ? (
            <video src={post.mediaUrl} controls playsInline className="w-full max-h-[420px]" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.mediaUrl} alt="" className="w-full max-h-[420px] object-cover" />
          )}
        </div>
      )}

      {post.content && (
        <p className="px-4 py-3 text-sm leading-relaxed">{post.content}</p>
      )}

      <div className="flex items-center gap-1 px-2 py-2 border-t border-border">
        <button
          type="button"
          disabled={liking}
          onClick={toggleLike}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition",
            post.likedByMe ? "text-primary" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Heart size={18} fill={post.likedByMe ? "currentColor" : "none"} />
          {post.likeCount || ""}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowComments((s) => !s);
            if (!showComments) loadComments();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm text-muted-foreground hover:bg-muted"
        >
          <MessageCircle size={18} />
          {post.commentCount || ""}
        </button>
        <button
          type="button"
          onClick={sharePost}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm text-muted-foreground hover:bg-muted"
        >
          <Share2 size={18} />
          {post.shareCount || ""}
        </button>
        <button
          type="button"
          onClick={toggleBookmark}
          className={cn(
            "ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition",
            post.bookmarkedByMe ? "text-primary" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Bookmark size={18} fill={post.bookmarkedByMe ? "currentColor" : "none"} />
        </button>
      </div>

      {showComments && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 text-sm">
              <Avatar src={c.user.profilePicture} name={c.user.name} size="xs" />
              <div>
                <span className="font-medium">{c.user.name}</span>{" "}
                <span className="text-muted-foreground">{c.content}</span>
              </div>
            </div>
          ))}
          <form onSubmit={submitComment} className="flex gap-2">
            <Input
              placeholder="Add a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="h-10"
            />
            <Button type="submit" size="icon" className="shrink-0">
              <Send size={16} />
            </Button>
          </form>
        </div>
      )}
    </motion.article>
  );
}

export function DiscoveriesFeed({
  ux,
  initialFeed,
}: {
  ux: DiscoveriesUxSettings;
  /** When set, first page was loaded on the server — skip client fetch on mount. */
  initialFeed?: { posts: DiscoveriesPostWithMeta[]; nextCursor: string | null };
}) {
  const [posts, setPosts] = useState<DiscoveriesPostWithMeta[]>(initialFeed?.posts ?? []);
  const [cursor, setCursor] = useState<string | null>(initialFeed?.nextCursor ?? null);
  const [loading, setLoading] = useState(initialFeed === undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (nextCursor?: string | null) => {
    const isMore = Boolean(nextCursor);
    if (isMore) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      const url = nextCursor
        ? `/api/discoveries?cursor=${encodeURIComponent(nextCursor)}`
        : "/api/discoveries";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not load discoveries");
      const data = await res.json();
      setPosts((prev) => (isMore ? [...prev, ...data.posts] : data.posts));
      setCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load discoveries");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (initialFeed !== undefined) return;
    load();
  }, [initialFeed, load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && cursor && !loadingMore) {
          load(cursor);
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, load, loadingMore]);

  const updatePost = useCallback((updated: DiscoveriesPostWithMeta) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  if (loading) {
    return (
      <div className="px-4">
        <ListLoading label="Loading discoveries…" />
      </div>
    );
  }

  if (error && !posts.length) {
    return (
      <div className="px-4">
        <ListError message={error} onRetry={() => load()} />
      </div>
    );
  }

  return (
    <div className="pb-6" data-discoveries-feed="hydrated" data-initial-ssr={initialFeed !== undefined}>
      {ux.showHeroBanner && <DiscoveriesHeroBanner expiryHours={ux.expiryHours} />}

      {posts.length === 0 ? (
        <DiscoveriesEmptyState expiryHours={ux.expiryHours} />
      ) : (
        <div className="space-y-4 px-4">
          {posts.map((post) => (
            <DiscoveriesPostCard
              key={post.id}
              post={post}
              onUpdate={updatePost}
              showExpiryIndicators={ux.showExpiryIndicators}
              showTrustContext={ux.showTrustContext}
            />
          ))}
          <div ref={sentinelRef} className="h-8 flex items-center justify-center">
            {loadingMore && <span className="text-xs text-muted-foreground">Loading…</span>}
          </div>
        </div>
      )}
    </div>
  );
}
