"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MessageCircle, Volume2, VolumeX, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo, cn } from "@/lib/utils";
import { STORY_DEFAULTS } from "@/lib/constants";
import type { StoryWithRelations } from "@/types";

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
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const story = stories[index];
  const totalSeconds =
    story?.mediaType === "video" ? STORY_DEFAULTS.segmentSeconds * 2 : STORY_DEFAULTS.segmentSeconds;

  useEffect(() => {
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (!story) return;
    if (paused) return;
    const start = Date.now() - (progress / 100) * totalSeconds * 1000;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / (totalSeconds * 1000)) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(id);
        if (index < stories.length - 1) setIndex((i) => i + 1);
        else handleClose();
      }
    }, 80);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, story?.id]);

  function handleClose() {
    if (onClose) onClose();
    else router.push(closeHref ?? "/home");
  }

  function tap(e: React.MouseEvent<HTMLDivElement>) {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left;
    if (x < width / 3) {
      setIndex((i) => Math.max(0, i - 1));
    } else {
      if (index < stories.length - 1) setIndex((i) => i + 1);
      else handleClose();
    }
  }

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* Progress bars */}
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
        {stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-[width] duration-75"
              style={{ width: `${i < index ? 100 : i === index ? progress : 0}%` }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
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
          {story.voiceNoteUrl || story.mediaType === "video" ? (
            <button
              onClick={() => setMuted((m) => !m)}
              className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/10"
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

      {/* Media */}
      <div
        className="h-full w-full relative select-none"
        onClick={tap}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
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

        {/* Caption */}
        {story.text && (
          <div className="absolute bottom-28 left-0 right-0 px-6 text-center">
            <p className="inline-block bg-black/40 px-4 py-2 rounded-2xl text-base">
              {story.text}
            </p>
          </div>
        )}

        {/* Tags */}
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
