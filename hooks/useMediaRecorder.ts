"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingState = "idle" | "recording" | "stopped";

export function useMediaRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

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
    setBlob(null);
    setDuration(0);
    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mime =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const finalBlob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      setBlob(finalBlob);
      setState("stopped");
      cleanup();
    };

    recorder.start();
    setState("recording");
    timerRef.current = window.setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, [state, cleanup]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setBlob(null);
    setDuration(0);
    setState("idle");
    cleanup();
  }, [cleanup]);

  return { state, duration, blob, start, stop, reset };
}
