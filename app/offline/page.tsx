import Link from "next/link";
import { COPY } from "@/lib/copy";

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">{COPY.appName}</h1>
      <p className="text-muted-foreground mt-2 max-w-sm">
        You&apos;re offline. Recent introductions and messages may still be available from cache.
      </p>
      <Link href="/home" className="btn-primary mt-6 px-6">
        Try again
      </Link>
    </main>
  );
}
