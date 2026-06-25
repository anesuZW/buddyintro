import { redirect } from "next/navigation";

/** Backwards-compatible redirect — admin moved to /maindash */
export default function AdminRedirectPage() {
  redirect("/maindash");
}
