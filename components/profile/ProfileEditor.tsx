"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useUpload } from "@/hooks/useUpload";

export function ProfileEditor({
  userId,
  initial,
}: {
  userId: string;
  initial: { name: string; profilePicture: string | null };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [profilePicture, setProfilePicture] = useState(initial.profilePicture);
  const [saving, setSaving] = useState(false);
  const { upload, uploading, progress, cancel } = useUpload();

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      e.target.value = "";
      return;
    }
    try {
      const { url } = await upload(f, { userId, kind: "image" });
      setProfilePicture(url);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast("Upload cancelled");
        return;
      }
      const message =
        err instanceof Error && err.message && !/prisma|ECONN|P100/i.test(err.message)
          ? err.message
          : "Avatar upload failed. Please try again.";
      toast.error(message);
    } finally {
      e.target.value = "";
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, profilePicture }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(
          typeof body?.reason === "string"
            ? body.reason
            : "Could not save profile. Please try again."
        );
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    } catch {
      toast.error("Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6 mt-4 space-y-4">
      <h3 className="font-semibold">Edit profile</h3>
      <Input
        placeholder="Display name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label className="block">
        <span className="text-sm text-muted-foreground">Profile picture</span>
        <input
          type="file"
          accept="image/*"
          onChange={onAvatar}
          disabled={uploading || saving}
          className="block mt-2 text-sm"
        />
      </label>
      {uploading ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>Uploading avatar… {progress}%</span>
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            Cancel
          </Button>
        </div>
      ) : null}
      <Button onClick={save} disabled={saving || uploading} className="w-full">
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
