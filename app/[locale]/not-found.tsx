import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        That link does not match anything in BuddyIntro.
      </p>
      <Link
        href="/home"
        className="mt-6 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Go home
      </Link>
    </div>
  );
}
