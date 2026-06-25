"use client";

import { useCallback, useState } from "react";
import { Contact, Phone, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { normalizePhone, isPhoneNumber } from "@/lib/phone";
import toast from "react-hot-toast";

export type PickedContact = {
  name: string;
  phone: string;
};

type ContactProperty = "name" | "tel";

interface ContactsManager {
  select: (
    properties: ContactProperty[],
    options?: { multiple?: boolean }
  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
}

declare global {
  interface Navigator {
    contacts?: ContactsManager;
  }
}

function supportsContactPicker() {
  return typeof navigator !== "undefined" && "contacts" in navigator && navigator.contacts;
}

export function ContactPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (contact: PickedContact) => void;
}) {
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [picking, setPicking] = useState(false);
  const [mode, setMode] = useState<"menu" | "manual">("menu");

  const reset = useCallback(() => {
    setManualName("");
    setManualPhone("");
    setMode("menu");
  }, []);

  async function pickFromDevice() {
    if (!supportsContactPicker()) {
      setMode("manual");
      return;
    }
    setPicking(true);
    try {
      const contacts = await navigator.contacts!.select(["name", "tel"], { multiple: false });
      const c = contacts[0];
      const name = c.name?.[0] || "Contact";
      const rawPhone = c.tel?.[0];
      if (!rawPhone) {
        toast.error("No phone number on that contact");
        return;
      }
      const phone = normalizePhone(rawPhone);
      if (!phone) {
        toast.error("Contact number must include country code (e.g. +263…)");
        return;
      }
      onSelect({ name, phone });
      reset();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Could not access contacts");
        setMode("manual");
      }
    } finally {
      setPicking(false);
    }
  }

  function submitManual() {
    const phone = normalizePhone(manualPhone);
    if (!phone) {
      toast.error("Use international format e.g. +263774123456");
      return;
    }
    onSelect({ name: manualName.trim() || phone, phone });
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }}>
      <div className="p-6 pt-10">
        <h2 className="text-lg font-bold mb-1">Select contact</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Choose someone from your phone to invite via WhatsApp, SMS, or iMessage.
        </p>

        {mode === "menu" && (
          <div className="space-y-3">
            <Button
              className="w-full h-12 justify-start gap-3"
              onClick={pickFromDevice}
              disabled={picking}
            >
              <Contact size={20} />
              {picking ? "Opening contacts…" : supportsContactPicker() ? "Select from contacts" : "Import contact"}
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 justify-start gap-3"
              onClick={() => setMode("manual")}
            >
              <Phone size={20} />
              Enter phone number
            </Button>
          </div>
        )}

        {mode === "manual" && (
          <div className="space-y-3">
            <Input
              placeholder="Contact name (optional)"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
            />
            <Input
              placeholder="+263774123456"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setMode("menu")}>
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!isPhoneNumber(manualPhone) && !manualPhone.startsWith("+")}
                onClick={submitManual}
              >
                Add contact
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Compact button + chip for story tag flow */
export function ContactTagButton({
  onSelect,
}: {
  onSelect: (contact: PickedContact) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <UserPlus size={16} />
        Select contact
      </Button>
      <ContactPicker open={open} onClose={() => setOpen(false)} onSelect={onSelect} />
    </>
  );
}

export function ContactTagChip({
  contact,
  onRemove,
}: {
  contact: PickedContact;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full text-xs bg-primary/10 text-primary"
    >
      <Avatar name={contact.name} size="xs" />
      <span className="font-medium">{contact.name}</span>
      <span className="text-muted-foreground">{contact.phone}</span>
    </button>
  );
}
