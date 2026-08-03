"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MessageCircle, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo, cn } from "@/lib/utils";
import { STORY_DEFAULTS } from "@/lib/constants";
import type { StoryWithRelations } from "@/types";

/**
 * Instagram-style story player:
 * - Silent images use the default segment timer.
 * - Video / voice notes pause the segment timer while media plays;
 *   auto-advance waits for media `ended` (with a safety cap).
 */
export function StoryPlayer({
  stories,
  currentUserId,
  onClose,
  closeHref,
}: {
  stories: StoryWithRelations[];
  currentUserId: string;
  onClose?: () => void;
  closeHref?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(stories);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [mediaDriven, setMediaDriven] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const advanceLock = useRef(false);

  const story = items[index];
  const isOwner = Boolean(story && story.userId === currentUserId);
  const hasVoice = Boolean(story?.voiceNoteUrl);
  const isVideo = story?.mediaType === "video";
  const usesMediaClock = Boolean(story && (isVideo || hasVoice));
  const fallbackSeconds = isVideo
    ? STORY_DEFAULTS.segmentSeconds * 2
    : STORY_DEFAULTS.segmentSeconds;

  useEffect(() => {
    setItems(stories);
    setIndex(0);
  }, [stories]);

  useEffect(() => {
    setProgress(0);
    setMediaDriven(false);
    advanceLock.current = false;
    const current = items[index];
    if (current) {
      // Voice on image starts unmuted so the note is heard; pure video starts muted.
      setMuted(current.mediaType === "video" && !current.voiceNoteUrl);
    }
  }, [index, items]);

  function handleClose() {
    if (onClose) onClose();
    else router.push(closeHref ?? "/home");
  }

  function goNext() {
    if (advanceLock.current) return;
    advanceLock.current = true;
    if (index < items.length - 1) setIndex((i) => i + 1);
    else handleClose();
  }

  function goPrev() {
    advanceLock.current = false;
    setIndex((i) => Math.max(0, i - 1));
  }

  // Sync pause/resume with underlying media elements.
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (paused) {
      video?.pause();
      audio?.pause();
    } else {
      void video?.play().catch(() => undefined);
      void audio?.play().catch(() => undefined);
    }
  }, [paused, index, story?.id]);

  // Pause on tab hide / background interruptions (calls, app switch).
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) setPaused(true);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Media-driven progress (video / voice). Advance only when ALL active
  // media tracks have ended — never cut a longer voice note short.
  useEffect(() => {
    if (!story || !usesMediaClock) return;

    let raf = 0;
    let safetyTimer: number | undefined;
    let videoDone = !isVideo;
    let audioDone = !hasVoice;

    const maybeAdvance = () => {
      if (!paused && videoDone && audioDone) goNext();
    };

    const tick = () => {
      const video = videoRef.current;
      const audio = audioRef.current;
      const vDur = video?.duration;
      const aDur = audio?.duration;
      const durations = [vDur, aDur].filter(
        (d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0
      );

      if (durations.length > 0) {
        setMediaDriven(true);
        const total = Math.max(...durations);
        // Drive the bar from the longer track so progress matches full playback.
        const primary =
          (vDur ?? 0) >= (aDur ?? 0) && video ? video : audio ?? video;
        const current = primary?.currentTime ?? 0;
        const pct = Math.min(100, (current / total) * 100);
        setProgress(pct);
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);

    safetyTimer = window.setTimeout(() => {
      if (!advanceLock.current) goNext();
    }, Math.max(fallbackSeconds, 120) * 1000);

    const onVideoEnded = () => {
      videoDone = true;
      maybeAdvance();
    };
    const onAudioEnded = () => {
      audioDone = true;
      maybeAdvance();
    };

    const video = videoRef.current;
    const audio = audioRef.current;
    video?.addEventListener("ended", onVideoEnded);
    audio?.addEventListener("ended", onAudioEnded);

    return () => {
      window.cancelAnimationFrame(raf);
      if (safetyTimer) window.clearTimeout(safetyTimer);
      video?.removeEventListener("ended", onVideoEnded);
      audio?.removeEventListener("ended", onAudioEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, story?.id, usesMediaClock, isVideo, hasVoice]);

  // Classic segment timer for silent images (no voice).
  useEffect(() => {
    if (!story || usesMediaClock || mediaDriven) return;
    if (paused) return;
    const start = Date.now() - (progress / 100) * fallbackSeconds * 1000;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / (fallbackSeconds * 1000)) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(id);
        goNext();
      }
    }, 80);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, story?.id, usesMediaClock, mediaDriven]);

  function tap(e: React.MouseEvent<HTMLDivElement>) {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left;
    if (x < width / 3) goPrev();
    else goNext();
  }

  async function deleteCurrentStory(e: React.MouseEvent) {
    e.stopPropagation();
    if (!story || !isOwner || deleting) return;
    setPaused(true);
    const ok = window.confirm("Delete this story? This cannot be undone.");
    if (!ok) {
      setPaused(false);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Could not delete story");
      }
      const remaining = items.filter((s) => s.id !== story.id);
      if (remaining.length === 0) {
        handleClose();
        router.refresh();
        return;
      }
      setItems(remaining);
      setIndex((i) => Math.min(i, remaining.length - 1));
      setProgress(0);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete story");
    } finally {
      setDeleting(false);
      setPaused(false);
    }
  }

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
        {items.map((s, i) => (
          <div key={s.id} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-[width] duration-75"
              style={{ width: `${i < index ? 100 : i === index ? progress : 0}%` }}
            />
          </div>
        ))}
      </div>

      <div className="absolute top-6 left-3 right-3 flex items-center justify-between z-10 mt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleClose}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/10"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
          <Avatar src={story.user.profilePicture} name={story.user.name} size="sm" />
          <div>
            <div className="text-sm font-semibold">{story.user.name}</div>
            <div className="text-[11px] text-white/70">{timeAgo(story.createdAt)}</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isOwner ? (
            <button
              type="button"
              onClick={deleteCurrentStory}
              disabled={deleting}
              className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-50"
              aria-label="Delete story"
            >
              <Trash2 size={18} />
            </button>
          ) : null}
          {story.voiceNoteUrl || story.mediaType === "video" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMuted((m) => !m);
              }}
              className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/10"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          ) : null}
          <button
            onClick={handleClose}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/10"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div
        className="h-full w-full relative select-none"
        onClick={tap}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={story.id}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {story.mediaType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={story.mediaUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                src={story.mediaUrl}
                autoPlay
                playsInline
                muted={muted}
                loop={false}
                className="max-h-full max-w-full"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {story.voiceNoteUrl && (
          <audio
            ref={audioRef}
            src={story.voiceNoteUrl}
            autoPlay
            muted={muted}
            className="hidden"
          />
        )}

        {story.text && (
          <div className="absolute bottom-28 left-0 right-0 px-6 text-center">
            <p className="inline-block bg-black/40 px-4 py-2 rounded-2xl text-base">
              {story.text}
            </p>
          </div>
        )}

        <div className="absolute bottom-16 left-0 right-0 px-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {story.tags.map((tag) => {
              const u = tag.taggedUser;
              if (!u) {
                return (
                  <span
                    key={tag.id}
                    className="bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs"
                  >
                    @{tag.taggedExternalEmail ?? tag.taggedExternalPhone ?? "invited"}
                  </span>
                );
              }
              if (u.id === currentUserId) {
                return (
                  <span
                    key={tag.id}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs",
                      "bg-primary text-primary-foreground"
                    )}
                  >
                    @you
                  </span>
                );
              }
              return (
                <Link
                  key={tag.id}
                  href={`/messages/${u.id}?story=${story.id}`}
                  className="bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 hover:bg-white/25 transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Avatar src={u.profilePicture} name={u.name} size="xs" />
                  {u.name}
                  <MessageCircle size={12} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
