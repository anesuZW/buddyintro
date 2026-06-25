"use client";



import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import toast from "react-hot-toast";

import {

  Image as ImageIcon,

  Video as VideoIcon,

  Mic,

  StopCircle,

  Trash2,

  Send,

  X,

  Search,

  Mail,

  Phone,

  ChevronLeft,

  ChevronRight,

  Users,

  UserPlus,

} from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";

import { Button } from "@/components/ui/Button";

import { Input, Textarea } from "@/components/ui/Input";

import { useUpload } from "@/hooks/useUpload";

import { useMediaRecorder } from "@/hooks/useMediaRecorder";

import { isEmail, cn } from "@/lib/utils";

import { normalizePhone, isPhoneNumber } from "@/lib/phone";

import { COPY } from "@/lib/copy";
import { BRAND } from "@/lib/branding";
import type { StoryVisibilityModeValue } from "@/lib/story-visibility-shared";

import type { TagInput, PhoneInviteShare } from "@/types";

import { InviteShareSheet } from "@/components/invite/InviteShareSheet";

import { ContactTagButton, type PickedContact } from "@/components/contacts/ContactPicker";



type UserOption = {

  id: string;

  name: string;

  email: string;

  profilePicture: string | null;

  trustProfile?: {
    sharedIntroducerCount: number;
    trustLevelLabel: string;
  };

};



type ResolvedTag =

  | { kind: "user"; user: UserOption }

  | { kind: "external"; email: string }

  | { kind: "phone"; phone: string; contactName?: string };



export function StoryUploader({

  currentUserId,

  activeStep = 0,

  onStepChange,

}: {

  currentUserId: string;

  activeStep?: number;

  onStepChange?: (step: number) => void;

}) {

  const router = useRouter();



  const [file, setFile] = useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);

  const [text, setText] = useState("");

  const [visibilityMode, setVisibilityMode] = useState<StoryVisibilityModeValue>(
    "mutual_introduction_network"
  );
  const [visibilityOptions, setVisibilityOptions] = useState<
    Array<{ id: StoryVisibilityModeValue; title: string; desc: string }>
  >([]);
  const [allowVisibilitySelection, setAllowVisibilitySelection] = useState(true);

  const [introductionCategoryId, setIntroductionCategoryId] = useState<string | null>(null);

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);



  const [tags, setTags] = useState<ResolvedTag[]>([]);

  const [search, setSearch] = useState("");

  const [results, setResults] = useState<UserOption[]>([]);

  const [searching, setSearching] = useState(false);



  const fileInputRef = useRef<HTMLInputElement>(null);



  const { upload, uploading } = useUpload();

  const recorder = useMediaRecorder();



  const [submitting, setSubmitting] = useState(false);

  const [phoneInvites, setPhoneInvites] = useState<PhoneInviteShare[]>([]);

  const [shareOpen, setShareOpen] = useState(false);



  useEffect(() => {

    if (!file) return;

    const url = URL.createObjectURL(file);

    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);

  }, [file]);



  useEffect(() => {

    if (!search.trim()) {

      setResults([]);

      return;

    }

    const t = setTimeout(async () => {

      setSearching(true);

      try {

        const res = await fetch(`/api/users/search?q=${encodeURIComponent(search)}`);

        if (res.ok) {

          const data = (await res.json()) as { users: UserOption[] };

          setResults(data.users);

        }

      } finally {

        setSearching(false);

      }

    }, 250);

    return () => clearTimeout(t);

  }, [search]);



  useEffect(() => {

    fetch("/api/introduction-categories")

      .then((res) => (res.ok ? res.json() : { categories: [] }))

      .then((data: { categories: Array<{ id: string; name: string }> }) =>

        setCategories(data.categories ?? [])

      )

      .catch(() => {});

  }, []);



  useEffect(() => {
    fetch("/api/introduction-visibility")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const opts = (data.enabledModes as StoryVisibilityModeValue[]).map(
          (id: StoryVisibilityModeValue) => ({
            id,
            title: data.labels[id]?.title ?? id,
            desc: data.labels[id]?.description ?? "",
          })
        );
        setVisibilityOptions(opts);
        setAllowVisibilitySelection(Boolean(data.allowUserSelection));
        setVisibilityMode(data.defaultMode as StoryVisibilityModeValue);
      })
      .catch(() => {});
  }, []);



  function pickFile(kind: "image" | "video") {

    setMediaType(kind);

    fileInputRef.current?.setAttribute(

      "accept",

      kind === "image" ? "image/*" : "video/mp4,video/webm,video/quicktime"

    );

    fileInputRef.current?.click();

  }



  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {

    const f = e.target.files?.[0];

    if (!f) return;

    setFile(f);

  }



  function addUserTag(u: UserOption) {

    if (tags.find((t) => t.kind === "user" && t.user.id === u.id)) return;

    setTags((prev) => [...prev, { kind: "user", user: u }]);

    setSearch("");

    setResults([]);

  }



  function addPhoneTag(phone: string, contactName?: string) {

    const p = normalizePhone(phone);

    if (!p) {

      toast.error("Use international format e.g. +263774123456");

      return;

    }

    if (tags.find((t) => t.kind === "phone" && t.phone === p)) return;

    setTags((prev) => [...prev, { kind: "phone", phone: p, contactName }]);

    setSearch("");

  }



  function addContactTag(contact: PickedContact) {

    addPhoneTag(contact.phone, contact.name);

  }



  function addExternalTag(email: string) {

    const e = email.trim().toLowerCase();

    if (!isEmail(e)) {

      toast.error("Enter a valid email address");

      return;

    }

    if (tags.find((t) => t.kind === "external" && t.email === e)) return;

    setTags((prev) => [...prev, { kind: "external", email: e }]);

    setSearch("");

  }



  function removeTag(idx: number) {

    setTags((prev) => prev.filter((_, i) => i !== idx));

  }



  const phoneTags = tags.filter((t): t is Extract<ResolvedTag, { kind: "phone" }> => t.kind === "phone");



  function canAdvance(fromStep: number) {

    if (fromStep === 0) return tags.length > 0;

    if (fromStep === 2) return Boolean(file && mediaType);

    return true;

  }



  function goNext() {

    if (!canAdvance(activeStep)) {

      if (activeStep === 0) toast.error("Add at least one person to introduce");

      if (activeStep === 2) toast.error("Add a photo or video");

      return;

    }

    onStepChange?.(Math.min(activeStep + 1, 3));

  }



  function goBack() {

    onStepChange?.(Math.max(activeStep - 1, 0));

  }



  async function submit() {

    if (!file || !mediaType) {

      toast.error("Pick a photo or video first");

      onStepChange?.(2);

      return;

    }

    if (tags.length === 0) {

      toast.error("Tag at least one person");

      onStepChange?.(0);

      return;

    }

    setSubmitting(true);

    try {

      const { url: mediaUrl } = await upload(file, {

        userId: currentUserId,

        kind: mediaType,

      });



      let voiceNoteUrl: string | undefined;

      if (recorder.blob) {

        const { url } = await upload(recorder.blob, {

          userId: currentUserId,

          kind: "audio",

          ext: "webm",

        });

        voiceNoteUrl = url;

      }



      const apiTags: TagInput[] = tags.map((t) => {

        if (t.kind === "user") return { kind: "user", userId: t.user.id };

        if (t.kind === "phone") return { kind: "phone", phone: t.phone };

        return { kind: "external", email: t.email };

      });



      const res = await fetch("/api/stories", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          mediaUrl,

          mediaType,

          voiceNoteUrl,

          text: text.trim() || null,

          tags: apiTags,

          introductionCategoryId,

          visibilityMode,

        }),

      });

      if (!res.ok) {

        const err = await res.json().catch(() => ({}));

        throw new Error(err.error || "Failed to create introduction");

      }

      const data = await res.json();

      if (data.phoneInvites?.length) {

        setPhoneInvites(data.phoneInvites);

        setShareOpen(true);

        onStepChange?.(3);

        toast.success("Introduction published! Send invitations now.");

      } else {

        toast.success("Introduction published!");

        router.push("/home");

        router.refresh();

      }

    } catch (err: unknown) {

      toast.error(err instanceof Error ? err.message : "Couldn't create introduction");

    } finally {

      setSubmitting(false);

    }

  }



  return (

    <div className="px-4 pb-10">

      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />



      {/* Step 1 — Who */}

      {activeStep === 0 && (

        <div className="mt-4 space-y-4">

          <div className="grid grid-cols-2 gap-3">

            <button

              type="button"

              className="card p-4 text-left border-primary/20 bg-fi-card"

              onClick={() => setSearch("")}

            >

              <UserPlus size={20} className="text-primary mb-2" />

              <div className="text-sm font-medium">Existing {BRAND.name} user</div>

              <div className="text-xs text-muted-foreground mt-1">Search by name or email</div>

            </button>

            <button

              type="button"

              className="card p-4 text-left border-primary/20 bg-fi-card"

              onClick={() => setSearch("+")}

            >

              <Phone size={20} className="text-primary mb-2" />

              <div className="text-sm font-medium">Someone new</div>

              <div className="text-xs text-muted-foreground mt-1">Invite by phone or email</div>

            </button>

          </div>



          {tags.length > 0 && (

            <div className="flex flex-wrap gap-2">

              {tags.map((t, i) => (

                <button

                  key={i}

                  onClick={() => removeTag(i)}

                  className={cn(

                    "flex items-center gap-2 pl-1 pr-2 py-1 rounded-full text-xs",

                    "bg-primary/10 text-primary"

                  )}

                >

                  {t.kind === "user" ? (

                    <>

                      <Avatar src={t.user.profilePicture} name={t.user.name} size="xs" />

                      {t.user.name}

                    </>

                  ) : t.kind === "phone" ? (

                    <>

                      <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">

                        <Phone size={10} />

                      </span>

                      {t.contactName ? `${t.contactName} · ` : ""}

                      {t.phone}

                    </>

                  ) : (

                    <>

                      <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">

                        <Mail size={10} />

                      </span>

                      {t.email}

                    </>

                  )}

                  <X size={12} />

                </button>

              ))}

            </div>

          )}



          <div className="mb-3">

            <ContactTagButton onSelect={addContactTag} />

          </div>



          <div className="relative">

            <Search

              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"

              size={16}

            />

            <Input

              className="pl-10"

              placeholder="Search by name, email, or phone (+country code)"

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              onKeyDown={(e) => {

                if (e.key === "Enter") {

                  e.preventDefault();

                  if (isEmail(search)) addExternalTag(search);

                  else if (search.trim().startsWith("+")) addPhoneTag(search);

                }

              }}

            />

            {search && (

              <div className="absolute z-10 mt-2 w-full rounded-2xl bg-card border border-border shadow-lg overflow-hidden">

                {searching && (

                  <div className="p-3 text-sm text-muted-foreground">Searching…</div>

                )}

                {!searching && results.length === 0 && isPhoneNumber(search) && (

                  <button

                    onClick={() => addPhoneTag(search)}

                    className="w-full text-left px-4 py-3 hover:bg-muted flex items-center gap-3"

                  >

                    <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">

                      <Phone size={14} />

                    </span>

                    <div>

                      <div className="text-sm font-medium">Invite {search}</div>

                      <div className="text-xs text-muted-foreground">

                        WhatsApp, SMS, or iMessage after publishing

                      </div>

                    </div>

                  </button>

                )}

                {!searching && results.length === 0 && isEmail(search) && (

                  <button

                    onClick={() => addExternalTag(search)}

                    className="w-full text-left px-4 py-3 hover:bg-muted flex items-center gap-3"

                  >

                    <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">

                      <Mail size={14} />

                    </span>

                    <div>

                      <div className="text-sm font-medium">Invite {search}</div>

                      <div className="text-xs text-muted-foreground">

                        Introduction stays draft until they join

                      </div>

                    </div>

                  </button>

                )}

                {!searching &&

                  results.length === 0 &&

                  !isEmail(search) &&

                  !isPhoneNumber(search) && (

                    <div className="p-3 text-sm text-muted-foreground">

                      No matches. Type a full email or phone (+country code) to invite.

                    </div>

                  )}

                {results.map((u) => (

                  <button

                    key={u.id}

                    onClick={() => addUserTag(u)}

                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3"

                  >

                    <Avatar src={u.profilePicture} name={u.name} size="sm" />

                    <div>

                      <div className="text-sm font-medium">{u.name}</div>

                      <div className="text-xs text-muted-foreground">{u.email}</div>

                      {u.trustProfile && u.trustProfile.sharedIntroducerCount > 0 && (

                        <div className="text-[10px] text-primary mt-0.5">

                          {u.trustProfile.sharedIntroducerCount} Shared Introducer

                          {u.trustProfile.sharedIntroducerCount === 1 ? "" : "s"} ·{" "}

                          {u.trustProfile.trustLevelLabel}

                        </div>

                      )}

                    </div>

                  </button>

                ))}

              </div>

            )}

          </div>

        </div>

      )}



      {/* Step 2 — Relationship category */}

      {activeStep === 1 && (

        <div className="mt-4 space-y-4">

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

            {categories.map((c) => (

              <button

                key={c.id}

                type="button"

                onClick={() => setIntroductionCategoryId(c.id)}

                className={cn(

                  "rounded-xl border px-3 py-2 text-left text-sm transition",

                  introductionCategoryId === c.id

                    ? "border-primary bg-primary/5 text-primary"

                    : "border-border"

                )}

              >

                {c.name}

              </button>

            ))}

          </div>



          <div className="space-y-2 pt-2 border-t border-border">

            <p className="text-xs font-medium text-muted-foreground">Visibility</p>

            {!allowVisibilitySelection && (
              <p className="text-xs text-muted-foreground">
                Platform default:{" "}
                {visibilityOptions.find((o) => o.id === visibilityMode)?.title ??
                  "Mutual introduction network"}
              </p>
            )}

            {allowVisibilitySelection &&
              visibilityOptions.map((opt) => (

              <button

                key={opt.id}

                type="button"

                disabled={visibilityOptions.length <= 1}

                onClick={() => setVisibilityMode(opt.id)}

                className={cn(

                  "card p-3 w-full text-left transition",

                  visibilityMode === opt.id ? "border-primary bg-primary/5" : "border-border"

                )}

              >

                <div className="text-sm font-medium">{opt.title}</div>

                <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>

              </button>

            ))}

          </div>

        </div>

      )}



      {/* Step 3 — Media + about this person */}

      {activeStep === 2 && (

        <div className="mt-4">

          {!file ? (

            <div className="card p-6 text-center">

              <h2 className="text-lg font-semibold">Photo or video</h2>

              <p className="text-sm text-muted-foreground mt-1">{COPY.step2Hint}</p>

              <div className="mt-6 grid grid-cols-2 gap-3">

                <button

                  onClick={() => pickFile("image")}

                  className="rounded-2xl border border-border p-6 hover:border-primary/60 transition flex flex-col items-center gap-2"

                >

                  <ImageIcon size={28} className="text-primary" />

                  <span className="text-sm font-medium">Photo</span>

                </button>

                <button

                  onClick={() => pickFile("video")}

                  className="rounded-2xl border border-border p-6 hover:border-primary/60 transition flex flex-col items-center gap-2"

                >

                  <VideoIcon size={28} className="text-primary" />

                  <span className="text-sm font-medium">Video</span>

                </button>

              </div>

            </div>

          ) : (

            <div className="card overflow-hidden">

              <div className="relative bg-black aspect-[9/16] flex items-center justify-center">

                {mediaType === "image" ? (

                  // eslint-disable-next-line @next/next/no-img-element

                  <img src={previewUrl ?? ""} alt="" className="max-h-full max-w-full" />

                ) : (

                  <video src={previewUrl ?? ""} className="max-h-full max-w-full" controls />

                )}

                <button

                  onClick={() => {

                    setFile(null);

                    setPreviewUrl(null);

                    setMediaType(null);

                  }}

                  className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center"

                >

                  <X size={16} />

                </button>

              </div>

              <div className="p-4 space-y-4">

                <Textarea

                  rows={3}

                  maxLength={280}

                  placeholder={COPY.step3Hint}

                  value={text}

                  onChange={(e) => setText(e.target.value)}

                />

                <div className="flex items-center gap-3">

                  {recorder.state === "idle" && (

                    <Button type="button" variant="outline" size="sm" onClick={recorder.start}>

                      <Mic size={16} />

                      Voice recommendation

                    </Button>

                  )}

                  {recorder.state === "recording" && (

                    <Button type="button" variant="destructive" size="sm" onClick={recorder.stop}>

                      <StopCircle size={16} />

                      Stop ({recorder.duration}s)

                    </Button>

                  )}

                  {recorder.state === "stopped" && recorder.blob && (

                    <div className="flex items-center gap-2 w-full">

                      <audio src={URL.createObjectURL(recorder.blob)} controls className="flex-1" />

                      <Button type="button" variant="ghost" size="icon" onClick={recorder.reset}>

                        <Trash2 size={16} />

                      </Button>

                    </div>

                  )}

                </div>

              </div>

            </div>

          )}

        </div>

      )}



      {/* Step 4 — Invite */}

      {activeStep === 3 && (

        <div className="mt-4 space-y-4">

          <div className="card p-4 border-primary/30 bg-primary/5">

            <h3 className="font-semibold text-primary">{COPY.step4Title}</h3>

            <p className="text-sm text-muted-foreground mt-1">{COPY.step4Hint}</p>

          </div>



          {phoneTags.length > 0 ? (

            <div className="space-y-2">

              {phoneTags.map((t, i) => (

                <div key={i} className="card p-3 flex items-center gap-3">

                  <Phone size={16} className="text-primary shrink-0" />

                  <div className="flex-1 min-w-0">

                    <div className="text-sm font-medium truncate">

                      {t.contactName ?? t.phone}

                    </div>

                    {t.contactName && (

                      <div className="text-xs text-muted-foreground">{t.phone}</div>

                    )}

                  </div>

                </div>

              ))}

              <p className="text-xs text-muted-foreground">

                Publish first, then send WhatsApp, SMS, iMessage, or copy link invitations.

              </p>

            </div>

          ) : (

            <div className="card p-4 text-sm text-muted-foreground">

              No phone invitations needed — everyone tagged is already on {BRAND.name} or invited by

              email.

            </div>

          )}



          {!shareOpen && (

            <Button

              className="w-full h-14"

              disabled={submitting || uploading || !file || tags.length === 0}

              onClick={submit}

            >

              <Send size={16} />

              {submitting || uploading ? "Publishing…" : COPY.postIntroduction}

            </Button>

          )}

        </div>

      )}



      {/* Navigation */}

      {activeStep < 3 && (

        <div className="sticky bottom-20 mt-6 z-10 flex gap-2">

          {activeStep > 0 && (

            <Button variant="outline" className="flex-1 h-12" onClick={goBack}>

              <ChevronLeft size={16} />

              Back

            </Button>

          )}

          {activeStep < 2 ? (

            <Button className="flex-1 h-12" onClick={goNext} disabled={!canAdvance(activeStep)}>

              Next

              <ChevronRight size={16} />

            </Button>

          ) : (

            <Button

              className="flex-1 h-12"

              disabled={submitting || uploading || !file || tags.length === 0}

              onClick={submit}

            >

              <Send size={16} />

              {submitting || uploading ? "Publishing…" : COPY.postIntroduction}

            </Button>

          )}

        </div>

      )}



      <InviteShareSheet

        invites={phoneInvites}

        open={shareOpen}

        onClose={() => {

          setShareOpen(false);

          router.push("/home");

          router.refresh();

        }}

      />

    </div>

  );

}

