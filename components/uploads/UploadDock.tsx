"use client";

import { useUploadManagerOptional } from "@/components/uploads/UploadManagerProvider";
import { cn } from "@/lib/utils";
import { ChevronUp, Loader2, Upload, X } from "lucide-react";

function progressBar(percent: number) {
  const filled = Math.max(0, Math.min(100, percent));
  const blocks = 12;
  const on = Math.round((filled / 100) * blocks);
  return "█".repeat(on) + "░".repeat(blocks - on);
}

export function UploadDock() {
  const mgr = useUploadManagerOptional();
  if (!mgr) return null;

  const { jobs, panelOpen, setPanelOpen, cancel, hide, retry, activeCount } = mgr;
  const visible = jobs.filter((j) => !j.hidden);
  const primary =
    visible.find(
      (j) =>
        j.status === "uploading" ||
        j.status === "queued" ||
        j.status === "finalizing"
    ) ?? visible[0];

  if (!primary && !panelOpen) return null;
  if (!primary && visible.length === 0) return null;

  return (
    <div className="fixed bottom-[calc(var(--nav-height,4.5rem)+0.75rem)] left-0 right-0 z-[60] px-3 pointer-events-none">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        {!panelOpen && primary ? (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur px-4 py-3 shadow-lg"
            aria-label="View uploads"
          >
            <Loader2
              size={18}
              className={cn(
                "shrink-0 text-primary",
                (primary.status === "uploading" ||
                  primary.status === "queued" ||
                  primary.status === "finalizing") &&
                  "animate-spin"
              )}
            />
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm font-medium truncate">
                {primary.status === "finalizing"
                  ? "Finishing introduction…"
                  : primary.status === "ready"
                    ? "Upload complete"
                    : primary.status === "error"
                      ? "Upload failed"
                      : "Uploading…"}
              </div>
              <div className="text-xs text-muted-foreground font-mono tracking-tight">
                {progressBar(primary.progress)} {primary.progress}%
              </div>
            </div>
            {activeCount > 1 ? (
              <span className="text-xs font-semibold text-primary">{activeCount}</span>
            ) : null}
            <ChevronUp size={16} className="text-muted-foreground" />
          </button>
        ) : null}

        {panelOpen ? (
          <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Upload size={16} />
                Uploads
              </div>
              <button
                type="button"
                className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-muted"
                aria-label="Close uploads"
                onClick={() => setPanelOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <ul className="max-h-[50vh] overflow-auto divide-y divide-border">
              {visible.length === 0 ? (
                <li className="p-4 text-sm text-muted-foreground">No active uploads.</li>
              ) : (
                visible.map((job) => (
                  <li key={job.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{job.fileName}</div>
                        <div className="text-xs text-muted-foreground">
                          {job.status === "uploading" || job.status === "queued"
                            ? "Uploading…"
                            : job.status === "finalizing"
                              ? "Creating introduction…"
                              : job.status === "ready"
                                ? "Ready"
                                : job.status === "cancelled"
                                  ? "Cancelled"
                                  : job.error || "Error"}
                        </div>
                      </div>
                      <div className="text-xs font-semibold tabular-nums shrink-0">
                        {job.progress}%
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-150",
                          job.status === "error" ? "bg-destructive" : "bg-primary"
                        )}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <div className="flex gap-2">
                      {(job.status === "queued" || job.status === "uploading") && (
                        <button
                          type="button"
                          className="text-xs font-medium text-destructive"
                          onClick={() => cancel(job.id)}
                        >
                          Cancel
                        </button>
                      )}
                      {job.status === "error" && (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary"
                          onClick={() => retry(job.id)}
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs font-medium text-muted-foreground"
                        onClick={() => hide(job.id)}
                      >
                        Hide
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
