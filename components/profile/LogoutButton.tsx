"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  return (
    <Button variant="outline" className="w-full" onClick={logout}>
      <LogOut size={16} />
      Log out
    </Button>
  );
}
