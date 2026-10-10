import { expect, userEvent } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { routeLoaded } from "#.storybook/route.ts";
import { notes } from "#db/schema.ts";
import { db } from "#lib/db.ts";
import { signInAs, testUser } from "#test/auth.ts";

// The form that edits a note, with its Server Action: see
// app/notes/[id]/edit/page.test.tsx.
const noteId = "00000000-0000-4000-8000-000000000001";

const meta = preview.meta({
  title: "Pages/Edit note",
  parameters: { layout: "fullscreen", nextjs: { url: `/notes/${noteId}/edit` } },
  async beforeEach() {
    await signInAs();
    await db.insert(notes).values({
      id: noteId,
      ownerId: testUser.id,
      title: "Reading list",
      content: "Books to read this quarter.",
    });
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByRole("heading", { level: 1, name: "Edit note" })).toBeVisible();
    await expect(canvas.getByLabelText("Title")).toHaveValue("Reading list");
    await expect(canvas.getByLabelText("Content")).toHaveValue("Books to read this quarter.");
  },
});

export const ValidationError = meta.story({
  async play({ canvas }) {
    await userEvent.clear(await canvas.findByLabelText("Title"));
    await userEvent.clear(canvas.getByLabelText("Content"));
    await userEvent.type(canvas.getByLabelText("Content"), "Changed body");
    await userEvent.click(canvas.getByRole("button", { name: "Save changes" }));

    await expect(await canvas.findByText("Title is required.")).toBeVisible();
    await expect(canvas.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByLabelText("Content")).toHaveValue("Changed body");
  },
});

// The action updates the note and redirects to its page.
export const Save = meta.story({
  async play({ canvas }) {
    const title = await canvas.findByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Reading list 2026");
    await userEvent.click(canvas.getByRole("button", { name: "Save changes" }));

    await routeLoaded(`/notes/${noteId}`);
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Reading list 2026" }),
    ).toBeVisible();
  },
});
