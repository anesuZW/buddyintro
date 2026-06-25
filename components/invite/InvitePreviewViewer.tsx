"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Play, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/branding";
import { cn } from "@/lib/utils";

export type InvitePreviewStory = {
  id: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  voiceNoteUrl?: string | null;
  text?: string | null;
};

export function InvitePreviewViewer({
  story,
  inviter,
  inviteToken,
}: {
  story: InvitePreviewStory;
  inviter: { name: string; profilePicture: string | null };
  inviteToken: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(story.mediaType === "video");
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (story.mediaType !== "video" || !videoRef.current) return;
    if (playing) {
      void videoRef.current.play().catch(() => setPlaying(false));
    } else {
      videoRef.current.pause();
    }
  }, [playing, story.mediaType]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  return (
    <div className="relative min-h-dvh bg-black text-white overflow-hidden">
      <div className="absolute inset-0">
        {story.mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.mediaUrl}
            alt=""
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              src={story.mediaUrl}
              playsInline
              loop
              muted={muted}
              className={cn(
                "h-full w-full object-cover transition-opacity",
                playing ? "opacity-90" : "opacity-70"
              )}
            />
            {!playing && (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/30"
                aria-label="Play video"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="h-20 w-20 rounded-full bg-white/90 text-black flex items-center justify-center shadow-2xl"
                >
                  <Play size={36} className="ml-1" fill="currentColor" />
                </motion.div>
              </button>
            )}
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />
      </div>

      {story.voiceNoteUrl && (
        <audio ref={audioRef} src={story.voiceNoteUrl} autoPlay muted={muted} />
      )}

      <div className="relative z-10 flex min-h-dvh flex-col px-4 pb-8 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar src={inviter.profilePicture} name={inviter.name} size="md" ring />
            <div>
              <p className="text-sm font-semibold">{inviter.name}</p>
              <p className="text-xs text-white/70">introduced you</p>
            </div>
          </div>
          {(story.mediaType === "video" || story.voiceNoteUrl) && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}
        </div>

        <div className="flex-1" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div>
            <p className="text-sm uppercase tracking-widest text-white/60">
              {BRAND.name}
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">
              You were invited to see an introduction
            </h1>
            {story.text && (
              <p className="mt-3 text-base text-white/90 leading-relaxed">
                &ldquo;{story.text}&rdquo;
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={`/signup?invite=${inviteToken}`} className="flex-1">
              <Button className="w-full h-12 text-base">Join to connect</Button>
            </Link>
            <Link href={`/invite/${inviteToken}`} className="flex-1">
              <button
                type="button"
                className="w-full h-12 rounded-full bg-white/10 text-white font-medium hover:bg-white/20 transition"
              >
                Accept invite
              </button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
