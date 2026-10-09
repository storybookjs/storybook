"use client";

import { expect, userEvent, waitFor, within } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { ModeToggle } from "./mode-toggle.tsx";

// The toggle between light and dark, in the layouts of the app, which have
// its ThemeProvider: see theme-toggle.stories.tsx.
const meta = preview.meta({
  title: "Components/ModeToggle",
  component: ModeToggle,
  parameters: { layout: "fullscreen", nextjs: { layouts: true } },
  render: () => (
    <main aria-label="Story" className="grid flex-1 place-items-center">
      <ModeToggle />
    </main>
  ),
});

export const Toggle = meta.story({
  async play({ canvas }) {
    const story = within(await canvas.findByRole("main", { name: "Story" }));
    const dark = document.documentElement.classList.contains("dark");

    await userEvent.click(story.getByRole("button", { name: "Toggle theme" }));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(!dark));

    await userEvent.click(story.getByRole("button", { name: "Toggle theme" }));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(dark));
  },
});
