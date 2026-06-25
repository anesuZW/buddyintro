"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full h-12 px-4 rounded-2xl bg-muted border border-transparent",
          "focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
          "outline-none transition placeholder:text-muted-foreground",
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full px-4 py-3 rounded-2xl bg-muted border border-transparent",
        "focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
        "outline-none transition placeholder:text-muted-foreground resize-none",
        className
      )}
      {...props}
    />
  );
});
