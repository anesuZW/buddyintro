"use client";

import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IntroductionStoryLink } from "@/components/connections/ConnectionReasonLink";
import { introductionDetailHref } from "@/lib/introduction-routes";
import type { ChatContextPayload } from "@/types";

export function IntroductionPathGraph({
  paths,
  viewerName,
  otherName,
}: {
  paths: NonNullable<ChatContextPayload["graph"]>["paths"];
  viewerName: string;
  otherName: string;
}) {
  if (!paths.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <h3 className="text-sm font-semibold">Introduction paths</h3>
      <div className="space-y-4">
        {paths.map((path) => (
          <div key={path.introducer.id} className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start text-center text-xs">
              <div className="space-y-1">
                <Avatar
                  src={path.introducer.profilePicture}
                  name={path.introducer.name}
                  size="sm"
                  className="mx-auto"
                />
                <div className="font-medium truncate">{path.introducer.name}</div>
                <ArrowDown size={14} className="mx-auto text-muted-foreground" />
                <div className="text-muted-foreground">Introduced</div>
                <ArrowDown size={14} className="mx-auto text-muted-foreground" />
                <Link
                  href={introductionDetailHref(path.toViewer.storyId)}
                  className="font-medium truncate text-primary hover:underline block"
                >
                  {viewerName}
                </Link>
              </div>

              <div className="pt-6 text-muted-foreground">&</div>

              <div className="space-y-1">
                <Avatar
                  src={path.introducer.profilePicture}
                  name={path.introducer.name}
                  size="sm"
                  className="mx-auto"
                />
                <div className="font-medium truncate">{path.introducer.name}</div>
                <ArrowDown size={14} className="mx-auto text-muted-foreground" />
                <div className="text-muted-foreground">Introduced</div>
                <ArrowDown size={14} className="mx-auto text-muted-foreground" />
                <Link
                  href={introductionDetailHref(path.toOther.storyId)}
                  className="font-medium truncate text-primary hover:underline block"
                >
                  {otherName}
                </Link>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <IntroductionStoryLink
                storyId={path.toViewer.storyId}
                label="Your intro story"
              />
              <IntroductionStoryLink
                storyId={path.toOther.storyId}
                label="Their intro story"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RelatedIntroductionsList({
  sections,
}: {
  sections: NonNullable<ChatContextPayload["graph"]>["relatedByIntroducer"];
}) {
  if (!sections.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      {sections.map((section) => (
        <div key={section.introducer.id}>
          <h3 className="text-sm font-semibold">
            Also introduced by {section.introducer.name}
          </h3>
          <ul className="mt-2 space-y-2">
            {section.people.map((person) => (
              <li
                key={person.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted transition text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar
                    src={person.profilePicture}
                    name={person.name}
                    size="sm"
                  />
                  <span className="font-medium truncate">{person.name}</span>
                </div>
                <IntroductionStoryLink storyId={person.storyId} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Link
        href="/introductions"
        className="text-xs text-primary font-medium hover:underline block text-center pt-1"
      >
        View all introductions
      </Link>
    </div>
  );
}
