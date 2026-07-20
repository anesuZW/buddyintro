import { saveStoryDraft, getStoryDraft, deleteStoryDraft, listStoryDrafts } from "@/lib/pwa/db";
import { enqueueOfflineRequest } from "@/lib/pwa/offline-queue";

export async function saveOfflineStoryDraft(id: string, payload: Record<string, unknown>) {
  return saveStoryDraft(id, payload);
}

export async function loadOfflineStoryDraft(id: string) {
  return getStoryDraft(id);
}

export async function clearOfflineStoryDraft(id: string) {
  return deleteStoryDraft(id);
}

export async function listOfflineStoryDrafts() {
  return listStoryDrafts();
}

export async function submitStoryWhenOnline(url: string, body: Record<string, unknown>) {
  if (navigator.onLine) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
  }
  return enqueueOfflineRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
