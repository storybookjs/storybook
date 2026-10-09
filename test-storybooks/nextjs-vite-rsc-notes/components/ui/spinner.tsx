"use client";

import { Loader2Icon } from "lucide-react";

import { cn } from "#lib/utils.ts";

function Spinner({ className, ...props }: React.ComponentProps<"output">) {
  return (
    <output aria-label="Loading" className={cn("inline-flex", className)} {...props}>
      <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
    </output>
  );
}

export { Spinner };
