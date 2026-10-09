"use client";

import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { ThemeToggle } from "./theme-toggle.tsx";

// A story file with `"use client"`: the toggle renders in the browser. It
// renders in the layouts of the app, which have its ThemeProvider: the
// provider of next-themes has a script that the server renders. Its menu
// opens in a portal, outside the story, where `screen` looks.
const meta = preview.meta({
  title: "Components/ThemeToggle",
  component: ThemeToggle,
  parameters: { layout: "fullscreen", nextjs: { layouts: true } },
  render: () => (
    <main aria-label="Story" className="grid flex-1 place-items-center">
      <ThemeToggle />
    </main>
  ),
});

export const PickATheme = meta.story({
  async play({ canvas }) {
    const story = within(await canvas.findByRole("main", { name: "Story" }));
    // Base UI opens the menu a frame after the press. Until then the items
    // of the menu that closed before are still there, as it animates out,
    // and take no pointer events: wait for the menu to be open.
    const openMenu = async () => {
      await userEvent.click(story.getByRole("button", { name: "Toggle theme" }));
      await story.findByRole("button", { name: "Toggle theme", expanded: true });
    };

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Light" }));
    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
  },
});
