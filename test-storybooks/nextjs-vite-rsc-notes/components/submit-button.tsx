"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "#components/ui/button.tsx";
import { cn } from "#lib/utils.ts";

export function SubmitButton({
  children,
  className,
  disabled,
  ...props
}: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      data-pending={pending || undefined}
      className={cn("relative isolate overflow-hidden", className)}
    >
      {pending && (
        <style>
          {`@keyframes submit-button-progress { from { transform: translateX(-120%); } to { transform: translateX(240%); } }`}
        </style>
      )}
      {pending && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-0.5 overflow-hidden rounded-b-[inherit] bg-current/20"
        >
          <span className="block h-full w-1/2 bg-current/70 motion-safe:animate-[submit-button-progress_1.1s_cubic-bezier(0.4,0,0.2,1)_infinite] motion-reduce:w-full" />
        </span>
      )}
      <span className="relative z-10 inline-flex items-center justify-center gap-[inherit]">
        {children}
      </span>
    </Button>
  );
}
