import preview from "#.storybook/preview.ts";
import { StarIcon } from "#components/icons.tsx";
import { Badge } from "./badge.tsx";

// A Server Component: no `"use client"` in the component or the story file.
const meta = preview.meta({
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { children: "Updated Jan 15, 2026" },
});

export const Default = meta.story();

export const Outline = meta.story({ args: { variant: "outline" } });

export const Favorite = meta.story({
  args: {
    variant: "secondary",
    children: (
      <>
        <StarIcon data-icon="inline-start" fill="currentColor" />
        Favorite
      </>
    ),
  },
});
