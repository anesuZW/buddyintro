"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
import { transportUpload } from "@/lib/upload-transport";
import { saveOfflineStoryDraft, clearOfflineStoryDraft } from "@/lib/pwa/story-offline";
import type {
  IntroductionUploadPayload,
  ReadyToShareState,
  UploadJob,
  UploadJobPayload,
} from "@/lib/upload-manager/types";
import type { PhoneInviteShare } from "@/types";
import { UploadDock } from "@/components/uploads/UploadDock";
import { ReadyToShareScreen } from "@/components/uploads/ReadyToShareScreen";

type EnqueueArgs = {
  file: File;
  mediaKind: UploadJob["mediaKind"];
  payload: UploadJobPayload;
};

type UploadManagerContextValue = {
  jobs: UploadJob[];
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  enqueue: (args: EnqueueArgs) => string;
  cancel: (jobId: string) => void;
  hide: (jobId: string) => void;
  retry: (jobId: string) => void;
  clearReady: () => void;
  readyToShare: ReadyToShareState | null;
  activeCount: number;
};

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

const DRAFT_KEY_PREFIX = "bg-intro-";

function newId() {
  return `upl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function recipientLabelFromPayload(payload: IntroductionUploadPayload): string | null {
  const phone = payload.tags.find((t) => t.kind === "phone");
  if (phone && phone.kind === "phone") return phone.phone;
  const email = payload.tags.find((t) => t.kind === "external");
  if (email && email.kind === "external") return email.email;
  return null;
}

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [readyToShare, setReadyToShare] = useState<ReadyToShareState | null>(null);
  const abortMap = useRef(new Map<string, AbortController>());
  const runningRef = useRef(false);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const updateJob = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const persistIntroDraft = useCallback(async (job: UploadJob) => {
    if (job.payload.kind !== "introduction") return;
    const p = job.payload;
    try {
      await saveOfflineStoryDraft(`${DRAFT_KEY_PREFIX}${job.id}`, {
        jobId: job.id,
        userId: p.userId,
        mediaType: p.mediaType,
        text: p.text,
        tags: p.tags,
        introductionCategoryId: p.introductionCategoryId,
        relationshipLabel: p.relationshipLabel,
        visibilityMode: p.visibilityMode,
        inviterName: p.inviterName ?? null,
        fileName: job.fileName,
        fileSize: job.fileSize,
        createdAt: job.createdAt,
        // Phone + tags must survive long uploads / navigation.
        phoneTags: p.tags.filter((t) => t.kind === "phone"),
      });
    } catch {
      /* IDB optional — in-memory manager still works */
    }
  }, []);

  const finalizeIntroduction = useCallback(
    async (job: UploadJob, mediaUrl: string, voiceNoteUrl?: string) => {
      if (job.payload.kind !== "introduction") return;
      const p = job.payload;

      // Idempotent: a successful prior finalize must not create a second story.
      if (job.storyId && job.phoneInvites?.length) {
        setReadyToShare({
          jobId: job.id,
          phoneInvites: job.phoneInvites,
          previewUrl: job.mediaUrl ?? mediaUrl,
          mediaType: p.mediaType,
          relationshipLabel: p.relationshipLabel,
          inviterName: p.inviterName ?? null,
          recipientLabel: recipientLabelFromPayload(p),
        });
        updateJob(job.id, { status: "ready", progress: 100, hidden: false });
        return;
      }
      if (job.storyId) {
        updateJob(job.id, { status: "ready", progress: 100, hidden: false });
        toast.success("Introduction already published!");
        return;
      }

      updateJob(job.id, { status: "finalizing", progress: 100 });

      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl,
          mediaType: p.mediaType,
          voiceNoteUrl,
          text: p.text,
          tags: p.tags,
          introductionCategoryId: p.introductionCategoryId,
          visibilityMode: p.visibilityMode,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Failed to create introduction"
        );
      }

      const data = (await res.json()) as {
        phoneInvites?: PhoneInviteShare[];
        story?: { id?: string };
        emailDelivery?: Array<{ ok?: boolean; email: string }>;
      };

      const failedEmails = (data.emailDelivery ?? []).filter((d) => d.ok === false);
      if (failedEmails.length) {
        toast.error(
          `Introduction saved, but invitation email could not be sent to ${failedEmails
            .map((d) => d.email)
            .join(", ")}.`
        );
      }

      const phoneInvites = data.phoneInvites ?? [];
      // Keep the job visible in the upload dock so progress remains discoverable
      // after Ready-to-Share closes (do not auto-hide).
      updateJob(job.id, {
        status: "ready",
        progress: 100,
        phoneInvites,
        storyId: data.story?.id,
        mediaUrl,
        hidden: false,
      });

      await clearOfflineStoryDraft(`${DRAFT_KEY_PREFIX}${job.id}`).catch(() => undefined);

      if (phoneInvites.length > 0) {
        setReadyToShare({
          jobId: job.id,
          phoneInvites,
          // Always use the uploaded remote URL — composer blob: previews are
          // revoked when StoryUploader unmounts after navigate-away.
          previewUrl: mediaUrl,
          mediaType: p.mediaType,
          relationshipLabel: p.relationshipLabel,
          inviterName: p.inviterName ?? null,
          recipientLabel: recipientLabelFromPayload(p),
        });
        toast.success("Ready to share!");
      } else {
        toast.success("Introduction published!");
      }
    },
    [updateJob]
  );

  const processQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const next = jobsRef.current.find((j) => j.status === "queued");
        if (!next) break;

        // Register abort controller BEFORE claiming the job so cancel cannot race.
        const controller = new AbortController();
        abortMap.current.set(next.id, controller);
        if (cancelledIds.has(next.id)) {
          abortMap.current.delete(next.id);
          updateJob(next.id, { status: "cancelled", error: "Cancelled" });
          continue;
        }
        updateJob(next.id, { status: "uploading", progress: 0, error: null });

        const file = fileMap.get(next.id);
        let uploadedMedia: Awaited<ReturnType<typeof transportUpload>> | null =
          next.result ?? null;
        let uploadedVoice: Awaited<ReturnType<typeof transportUpload>> | null =
          next.voiceResult ?? null;

        if (!file && !uploadedMedia) {
          updateJob(next.id, {
            status: "error",
            error: "Upload file was lost. Please try again.",
          });
          continue;
        }

        try {
          await persistIntroDraft(next);
          if (!uploadedMedia) {
            uploadedMedia = await transportUpload(file!, {
              kind: next.mediaKind,
              signal: controller.signal,
              onProgress: (p) => updateJob(next.id, { progress: p.percent }),
            });
            updateJob(next.id, { result: uploadedMedia });
          }

          if (
            next.payload.kind === "introduction" &&
            next.payload.voiceBlob &&
            !uploadedVoice
          ) {
            updateJob(next.id, { progress: 95 });
            uploadedVoice = await transportUpload(next.payload.voiceBlob, {
              kind: "audio",
              ext: next.payload.voiceExt || "webm",
              signal: controller.signal,
            });
            updateJob(next.id, { voiceResult: uploadedVoice });
          }

          updateJob(next.id, { progress: 100 });

          if (next.payload.kind === "introduction") {
            await finalizeIntroduction(
              { ...next, result: uploadedMedia, voiceResult: uploadedVoice },
              uploadedMedia.url,
              uploadedVoice?.url
            );
          } else {
            updateJob(next.id, { status: "ready", progress: 100 });
            toast.success("Upload complete");
          }
          fileMap.delete(next.id);
          cancelledIds.delete(next.id);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            updateJob(next.id, { status: "cancelled", error: "Cancelled" });
            fileMap.delete(next.id);
            toast("Upload cancelled");
          } else {
            // Keep remote URLs on the job so "Retry" can finalize without re-upload.
            updateJob(next.id, {
              status: "error",
              error: err instanceof Error ? err.message : "Upload failed",
              result: uploadedMedia,
              voiceResult: uploadedVoice,
            });
            toast.error(err instanceof Error ? err.message : "Upload failed");
          }
        } finally {
          abortMap.current.delete(next.id);
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [finalizeIntroduction, persistIntroDraft, updateJob]);

  useEffect(() => {
    if (jobs.some((j) => j.status === "queued")) {
      void processQueue();
    }
  }, [jobs, processQueue]);

  const enqueue = useCallback(
    (args: EnqueueArgs) => {
      const id = newId();
      fileMap.set(id, args.file);

      // Do not retain composer blob: URLs — they are revoked on unmount.
      const payload: UploadJobPayload =
        args.payload.kind === "introduction"
          ? { ...args.payload, previewUrl: null }
          : args.payload;

      const job: UploadJob = {
        id,
        createdAt: Date.now(),
        fileName: args.file.name || `${args.mediaKind}-upload`,
        fileSize: args.file.size,
        mediaKind: args.mediaKind,
        status: "queued",
        progress: 0,
        hidden: false,
        payload,
      };
      setJobs((prev) => [job, ...prev]);
      setPanelOpen(true);
      toast.success("Uploading in the background — you can keep browsing.");
      return id;
    },
    []
  );

  const cancel = useCallback((jobId: string) => {
    cancelledIds.add(jobId);
    abortMap.current.get(jobId)?.abort();
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId &&
        (j.status === "queued" || j.status === "uploading" || j.status === "finalizing")
          ? { ...j, status: "cancelled" as const, error: "Cancelled" }
          : j
      )
    );
    void clearOfflineStoryDraft(`${DRAFT_KEY_PREFIX}${jobId}`).catch(() => undefined);
  }, []);

  const hide = useCallback((jobId: string) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, hidden: true } : j)));
  }, []);

  const retry = useCallback((jobId: string) => {
    cancelledIds.delete(jobId);
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId && j.status === "error"
          ? { ...j, status: "queued" as const, error: null, hidden: false }
          : j
      )
    );
    setPanelOpen(true);
  }, []);

  const clearReady = useCallback(() => setReadyToShare(null), []);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      const busy = jobsRef.current.some(
        (j) =>
          j.status === "queued" ||
          j.status === "uploading" ||
          j.status === "finalizing"
      );
      if (!busy) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const activeCount = jobs.filter(
    (j) => j.status === "queued" || j.status === "uploading" || j.status === "finalizing"
  ).length;

  const value = useMemo(
    () => ({
      jobs,
      panelOpen,
      setPanelOpen,
      enqueue,
      cancel,
      hide,
      retry,
      clearReady,
      readyToShare,
      activeCount,
    }),
    [jobs, panelOpen, enqueue, cancel, hide, retry, clearReady, readyToShare, activeCount]
  );

  return (
    <UploadManagerContext.Provider value={value}>
      {children}
      <UploadDock />
      {readyToShare ? (
        <ReadyToShareScreen state={readyToShare} onClose={clearReady} />
      ) : null}
    </UploadManagerContext.Provider>
  );
}

/** Holds File blobs outside React state (not serializable). */
const fileMap = new Map<string, File>();
/** Jobs cancelled before their AbortController was registered. */
const cancelledIds = new Set<string>();

export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) {
    throw new Error("useUploadManager must be used within UploadManagerProvider");
  }
  return ctx;
}

/** Optional hook for surfaces that may render outside the provider. */
export function useUploadManagerOptional() {
  return useContext(UploadManagerContext);
}
