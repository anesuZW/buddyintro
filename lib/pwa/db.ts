import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const PWA_DB_NAME = "buddyintro-pwa";
export const PWA_DB_VERSION = 1;

export type QueuedUpload = {
  id: string;
  createdAt: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyBase64: string;
  retries: number;
};

export type StoryDraft = {
  id: string;
  updatedAt: number;
  payload: Record<string, unknown>;
};

export type CachedFeedEntry = {
  key: string;
  updatedAt: number;
  data: unknown;
};

export type CachedProfile = {
  userId: string;
  updatedAt: number;
  data: unknown;
};

export type NotificationState = {
  key: string;
  unreadCount: number;
  updatedAt: number;
};

interface BuddyIntroPwaDb extends DBSchema {
  storyDrafts: {
    key: string;
    value: StoryDraft;
    indexes: { "by-updated": number };
  };
  queuedUploads: {
    key: string;
    value: QueuedUpload;
    indexes: { "by-created": number };
  };
  notificationState: {
    key: string;
    value: NotificationState;
  };
  cachedProfiles: {
    key: string;
    value: CachedProfile;
  };
  cachedFeed: {
    key: string;
    value: CachedFeedEntry;
  };
  kv: {
    key: string;
    value: { key: string; value: unknown; updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<BuddyIntroPwaDb>> | null = null;

export function getPwaDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB<BuddyIntroPwaDb>(PWA_DB_NAME, PWA_DB_VERSION, {
      upgrade(db) {
        const drafts = db.createObjectStore("storyDrafts", { keyPath: "id" });
        drafts.createIndex("by-updated", "updatedAt");

        const uploads = db.createObjectStore("queuedUploads", { keyPath: "id" });
        uploads.createIndex("by-created", "createdAt");

        db.createObjectStore("notificationState", { keyPath: "key" });
        db.createObjectStore("cachedProfiles", { keyPath: "userId" });
        db.createObjectStore("cachedFeed", { keyPath: "key" });
        db.createObjectStore("kv", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export async function saveStoryDraft(id: string, payload: Record<string, unknown>) {
  const db = await getPwaDb();
  const row: StoryDraft = { id, payload, updatedAt: Date.now() };
  await db.put("storyDrafts", row);
  return row;
}

export async function getStoryDraft(id: string) {
  const db = await getPwaDb();
  return db.get("storyDrafts", id);
}

export async function listStoryDrafts() {
  const db = await getPwaDb();
  return db.getAllFromIndex("storyDrafts", "by-updated");
}

export async function deleteStoryDraft(id: string) {
  const db = await getPwaDb();
  await db.delete("storyDrafts", id);
}

export async function queueUpload(entry: Omit<QueuedUpload, "id" | "createdAt" | "retries"> & { id?: string }) {
  const db = await getPwaDb();
  const row: QueuedUpload = {
    id: entry.id ?? crypto.randomUUID(),
    createdAt: Date.now(),
    retries: 0,
    url: entry.url,
    method: entry.method,
    headers: entry.headers,
    bodyBase64: entry.bodyBase64,
  };
  await db.put("queuedUploads", row);
  return row;
}

export async function listQueuedUploads() {
  const db = await getPwaDb();
  return db.getAllFromIndex("queuedUploads", "by-created");
}

export async function removeQueuedUpload(id: string) {
  const db = await getPwaDb();
  await db.delete("queuedUploads", id);
}

export async function setNotificationState(key: string, unreadCount: number) {
  const db = await getPwaDb();
  await db.put("notificationState", { key, unreadCount, updatedAt: Date.now() });
}

export async function getNotificationState(key: string) {
  const db = await getPwaDb();
  return db.get("notificationState", key);
}

export async function cacheFeed(key: string, data: unknown) {
  const db = await getPwaDb();
  await db.put("cachedFeed", { key, data, updatedAt: Date.now() });
}

export async function getCachedFeed(key: string) {
  const db = await getPwaDb();
  return db.get("cachedFeed", key);
}

export async function cacheProfile(userId: string, data: unknown) {
  const db = await getPwaDb();
  await db.put("cachedProfiles", { userId, data, updatedAt: Date.now() });
}

export async function getCachedProfile(userId: string) {
  const db = await getPwaDb();
  return db.get("cachedProfiles", userId);
}

export async function setKv(key: string, value: unknown) {
  const db = await getPwaDb();
  await db.put("kv", { key, value, updatedAt: Date.now() });
}

export async function getKv<T = unknown>(key: string) {
  const db = await getPwaDb();
  const row = await db.get("kv", key);
  return (row?.value as T) ?? null;
}
