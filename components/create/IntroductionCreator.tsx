"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { COPY } from "@/lib/copy";

const StoryUploader = dynamic(
  () => import("@/components/stories/StoryUploader").then((m) => m.StoryUploader),
  {
    ssr: false,
    loading: () => (
      <div className="card p-8 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="mt-6 h-64 bg-muted rounded-2xl" />
      </div>
    ),
  }
);

const STEPS = [
  { title: COPY.step1Title, hint: COPY.step1Hint },
  { title: COPY.step2Title, hint: COPY.step2Hint },
  { title: COPY.step3Title, hint: COPY.step3Hint },
  { title: COPY.step4Title, hint: COPY.step4Hint },
];

export function IntroductionCreator({ currentUserId }: { currentUserId: string }) {
  const [step, setStep] = useState(0);

  return (
    <div>
      <div className="px-4 mt-4">
        <div className="flex gap-1 mb-3">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "h-1 flex-1 rounded-full transition",
                i <= step ? "bg-primary" : "bg-muted"
              )}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>
        <h2 className="text-sm font-semibold">{STEPS[step].title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{STEPS[step].hint}</p>
      </div>

      <StoryUploader
        currentUserId={currentUserId}
        activeStep={step}
        onStepChange={setStep}
      />
    </div>
  );
}
