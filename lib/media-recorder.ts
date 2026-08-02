/**
 * Browser MediaRecorder MIME selection (client-safe, no server imports).
 */

export type AudioRecordingFormat = {
  mimeType: string;
  ext: string;
};

const CANDIDATES: AudioRecordingFormat[] = [
  { mimeType: "audio/webm;codecs=opus", ext: "webm" },
  { mimeType: "audio/webm", ext: "webm" },
  { mimeType: "audio/mp4", ext: "mp4" },
  { mimeType: "audio/aac", ext: "aac" },
];

/** Pick the best supported audio recording format for this browser. */
export function pickAudioRecordingFormat(): AudioRecordingFormat {
  if (typeof MediaRecorder !== "undefined") {
    for (const candidate of CANDIDATES) {
      if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
        return candidate;
      }
    }
  }
  return { mimeType: "audio/webm", ext: "webm" };
}

export function isMediaRecorderSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}
