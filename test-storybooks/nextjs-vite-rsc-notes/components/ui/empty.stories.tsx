import { expect } from "storybook/test";
import preview from "#.storybook/preview.ts";
import Link from "next/link";
import { FilePenLineIcon } from "#components/icons.tsx";
import { notes } from "#db/schema.ts";
import { db } from "#lib/db.ts";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty.tsx";

// The empty state of the list of notes, with a link of Next's router. Not the
// link of the app, which shows its progress in a bar of the root layout.
const meta = preview.meta({
  title: "UI/Empty",
  component: Empty,
});

export const NoNotes = meta.story({
  parameters: { nextjs: { url: "/notes" } },
  // A render function of a story without `"use client"` is a Server
  // Component: it can be async, and read what the story seeded.
  render: async () => {
    const count = (await db.select().from(notes)).length;
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FilePenLineIcon />
          </EmptyMedia>
          <EmptyTitle>{count === 0 ? "No notes yet" : `${count} notes`}</EmptyTitle>
          <EmptyDescription>Capture an idea, a todo, or a thought.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href="/notes/new">Create your first note</Link>
        </EmptyContent>
      </Empty>
    );
  },
  async play({ canvas }) {
    await expect(await canvas.findByText("No notes yet")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Create your first note" })).toHaveAttribute(
      "href",
      "/notes/new",
    );
  },
});
