import type { TagInput, PhoneInviteShare } from "@/types";
import type { StoryVisibilityModeValue } from "@/lib/story-visibility-shared";
import type { UploadKind, UploadResult } from "@/lib/upload-transport";

export type UploadJobStatus =
  | "queued"
  | "uploading"
  | "finalizing"
  | "ready"
  | "error"
  | "cancelled";

export type IntroductionUploadPayload = {
  kind: "introduction";
  userId: string;
  mediaType: "image" | "video";
  text: string | null;
  tags: TagInput[];
  introductionCategoryId: string | null;
  /** Human label for relationship (e.g. "Church Friend") — used in share copy. */
  relationshipLabel: string | null;
  visibilityMode: StoryVisibilityModeValue;
  /** Optional voice note blob uploaded after media. */
  voiceBlob?: Blob | null;
  voiceExt?: string | null;
  /** Local preview URL for Ready-to-Share (object URL or remote after upload). */
  previewUrl?: string | null;
  inviterName?: string | null;
};

export type SimpleUploadPayload = {
  kind: "simple";
  userId: string;
  label?: string;
};

export type UploadJobPayload = IntroductionUploadPayload | SimpleUploadPayload;

export type UploadJob = {
  id: string;
  createdAt: number;
  fileName: string;
  fileSize: number;
  mediaKind: UploadKind;
  status: UploadJobStatus;
  progress: number;
  error?: string | null;
  hidden: boolean;
  result?: UploadResult | null;
  voiceResult?: UploadResult | null;
  payload: UploadJobPayload;
  /** Set when introduction story is created successfully. */
  phoneInvites?: PhoneInviteShare[];
  storyId?: string;
  mediaUrl?: string;
};

export type ReadyToShareState = {
  jobId: string;
  phoneInvites: PhoneInviteShare[];
  previewUrl: string | null;
  mediaType: "image" | "video";
  relationshipLabel: string | null;
  inviterName: string | null;
  recipientLabel: string | null;
};
