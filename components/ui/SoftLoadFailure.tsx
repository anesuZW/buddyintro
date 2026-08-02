import Link from "next/link";

/** Inline soft failure when a page section cannot load data (DB blip, etc.). */
export function SoftLoadFailure({
  title = "Could not load this section",
  description = "A temporary connection problem interrupted loading. Your session is still saved.",
  retryHref,
}: {
  title?: string;
  description?: string;
  retryHref?: string;
}) {
  return (
    <div className="mx-4 my-6 rounded-2xl border border-border bg-muted/30 px-4 py-8 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      {retryHref ? (
        <Link
          href={retryHref}
          className="inline-block mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </Link>
      ) : null}
    </div>
  );
}
