"use client";

import { MoonIcon, SunIcon } from "#components/icons.tsx";
import { useTheme } from "next-themes";
import { Button } from "#components/ui/button.tsx";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(nextTheme)}
    >
      {resolvedTheme === "dark" ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
}
