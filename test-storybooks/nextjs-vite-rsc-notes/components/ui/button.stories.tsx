import { expect } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { PlusIcon, Trash2Icon } from "#components/icons.tsx";
import { Button } from "./button.tsx";

// A Client Component of shadcn/ui, rendered by a Server Component: the story
// file has no `"use client"`, so its args go through Flight.
const meta = preview.meta({
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { children: "Create note" },
});

export const Default = meta.story({
  async play({ canvas }) {
    const button = await canvas.findByRole("button", { name: "Create note" });
    await expect(button).toBeEnabled();
    // The font of the app, which the decorator of the project sets.
    await expect(getComputedStyle(button).fontFamily).toContain("Geist");
  },
});

export const Outline = meta.story({ args: { variant: "outline", children: "Cancel" } });

export const Destructive = meta.story({
  args: {
    variant: "destructive",
    children: (
      <>
        <Trash2Icon data-icon="inline-start" />
        Delete
      </>
    ),
  },
});

export const WithIcon = meta.story({
  args: {
    children: (
      <>
        <PlusIcon data-icon="inline-start" />
        New note
      </>
    ),
  },
});

export const Disabled = meta.story({
  args: { disabled: true },
  async play({ canvas }) {
    await expect(await canvas.findByRole("button", { name: "Create note" })).toBeDisabled();
  },
});
