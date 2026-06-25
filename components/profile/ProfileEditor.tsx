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
  const { upload, uploading } = useUpload();

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { url } = await upload(f, { userId, kind: "image" });
      setProfilePicture(url);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
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
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Profile updated");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
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
        <span className="text-sm text-muted-foreground">
          Profile picture
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={onAvatar}
          className="block mt-2 text-sm"
        />
      </label>
      <Button onClick={save} disabled={saving || uploading} className="w-full">
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
