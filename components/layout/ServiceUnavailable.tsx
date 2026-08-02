import Link from "next/link";

/** Shown when authenticated shells cannot load because the database is unreachable. */
export function ServiceUnavailable() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">BuddyIntro is temporarily unavailable</h1>
      <p className="mt-3 text-sm text-muted-foreground max-w-md">
        We could not reach the database. Your session is still saved — please try again in a
        moment.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/home"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-border px-4 py-2 text-sm font-medium"
        >
          Sign in again
        </Link>
      </div>
    </div>
  );
}
