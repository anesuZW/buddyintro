"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type InviteOnboardingState = {
  token: string | null;
  email: string | null;
  inviterName: string | null;
  inviterAvatar: string | null;
  storyMediaUrl: string | null;
  storyMediaType: "image" | "video" | null;
  storyCaption: string | null;
  setInvite: (data: {
    token: string;
    email: string;
    inviterName?: string;
    inviterAvatar?: string | null;
    storyMediaUrl?: string;
    storyMediaType?: "image" | "video";
    storyCaption?: string | null;
  }) => void;
  clearInvite: () => void;
};

const initial = {
  token: null,
  email: null,
  inviterName: null,
  inviterAvatar: null,
  storyMediaUrl: null,
  storyMediaType: null,
  storyCaption: null,
};

export const useInviteOnboarding = create<InviteOnboardingState>()(
  persist(
    (set) => ({
      ...initial,
      setInvite: (data) =>
        set({
          token: data.token,
          email: data.email,
          inviterName: data.inviterName ?? null,
          inviterAvatar: data.inviterAvatar ?? null,
          storyMediaUrl: data.storyMediaUrl ?? null,
          storyMediaType: data.storyMediaType ?? null,
          storyCaption: data.storyCaption ?? null,
        }),
      clearInvite: () => set(initial),
    }),
    { name: "fi-invite-onboarding" }
  )
);
