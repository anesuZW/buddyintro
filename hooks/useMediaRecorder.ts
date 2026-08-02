"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isMediaRecorderSupported,
  pickAudioRecordingFormat,
  type AudioRecordingFormat,
} from "@/lib/media-recorder";
import { MAX_VOICE_RECORD_SECONDS } from "@/lib/constants";

export type RecordingState = "idle" | "recording" | "stopped";

export type MediaRecorderErrorCode =
  | "unsupported"
  | "permission_denied"
  | "not_found"
  | "recorder_error"
  | "unknown";

function logStage(stage: string, detail?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[voice-recorder]", stage, detail ?? "");
  }
}

function mapGetUserMediaError(err: unknown): { code: MediaRecorderErrorCode; message: string } {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      code: "permission_denied",
      message: "Microphone access was denied. Allow microphone permission in your browser settings.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      code: "not_found",
      message: "No microphone was found on this device.",
    };
  }
  return {
    code: "unknown",
    message: err instanceof Error ? err.message : "Could not access the microphone.",
  };
}

export function useMediaRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [format, setFormat] = useState<AudioRecordingFormat>(() => pickAudioRecordingFormat());
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<MediaRecorderErrorCode | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const mimeRef = useRef<string>("");

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (state === "recording") return;
    setError(null);
    setErrorCode(null);
    setBlob(null);
    setDuration(0);
    chunksRef.current = [];

    if (!isMediaRecorderSupported()) {
      const message = "Voice recording is not supported in this browser.";
      setError(message);
      setErrorCode("unsupported");
      logStage("unsupported");
      return;
    }

    const picked = pickAudioRecordingFormat();
    setFormat(picked);
    logStage("format_selected", picked);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      logStage("getUserMedia_ok");

      const recorder = picked.mimeType
        ? new MediaRecorder(stream, { mimeType: picked.mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      mimeRef.current = recorder.mimeType || picked.mimeType;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = (e) => {
        logStage("recorder_error", { error: e });
        setError("Recording failed. Try again.");
        setErrorCode("recorder_error");
        cleanup();
        setState("idle");
      };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, {
          type: mimeRef.current || picked.mimeType || "audio/webm",
        });
        logStage("blob_created", { bytes: finalBlob.size, type: finalBlob.type });
        setBlob(finalBlob);
        setState("stopped");
        cleanup();
      };

      recorder.start(1000);
      setState("recording");
      logStage("recording_started");

      timerRef.current = window.setInterval(() => {
        setDuration((d) => {
          const next = d + 1;
          if (next >= MAX_VOICE_RECORD_SECONDS) {
            recorderRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      const mapped = mapGetUserMediaError(err);
      setError(mapped.message);
      setErrorCode(mapped.code);
      logStage("getUserMedia_failed", mapped);
      cleanup();
      setState("idle");
    }
  }, [state, cleanup]);

  const stop = useCallback(() => {
    logStage("recording_stop_requested");
    recorderRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setBlob(null);
    setDuration(0);
    setError(null);
    setErrorCode(null);
    setState("idle");
    cleanup();
    logStage("reset");
  }, [cleanup]);

  return { state, duration, blob, format, error, errorCode, start, stop, reset };
}
