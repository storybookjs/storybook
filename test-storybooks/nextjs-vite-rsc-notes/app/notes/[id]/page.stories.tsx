import { expect, spyOn, userEvent } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { routeLoaded } from "#.storybook/route.ts";
import { notes } from "#db/schema.ts";
import { db } from "#lib/db.ts";
import { otherUser, signInAs, testUser } from "#test/auth.ts";

// The page of one note: see app/notes/[id]/page.test.tsx.
const noteId = "00000000-0000-4000-8000-000000000001";
const updatedAt = new Date("2026-01-15T12:00:00.000Z");

const meta = preview.meta({
  title: "Pages/Note",
  parameters: { layout: "fullscreen", nextjs: { url: `/notes/${noteId}` } },
  async beforeEach() {
    await signInAs();
  },
});

export const Note = meta.story({
  async beforeEach() {
    await db.insert(notes).values({
      id: noteId,
      ownerId: testUser.id,
      title: "Product roadmap Q3",
      content:
        "Ship offline sync first, then shared notebooks.\nRevisit the pricing page once the beta feedback is in.",
      updatedAt,
    });
  },
  async play({ canvas }) {
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Product roadmap Q3" }),
    ).toBeVisible();
    await expect(canvas.getByText(/Updated Jan 15, 2026/)).toBeVisible();
    await expect(canvas.getByText(/Ship offline sync first, then shared notebooks./)).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Edit" })).toBeVisible();
  },
});

export const EmptyContent = meta.story({
  async beforeEach() {
    await db.insert(notes).values({
      id: noteId,
      ownerId: testUser.id,
      title: "Untitled thoughts",
      content: "",
      updatedAt,
    });
  },
  async play({ canvas }) {
    await expect(await canvas.findByText("No content yet.")).toBeVisible();
  },
});

export const Favorite = meta.story({
  async beforeEach() {
    await db.insert(notes).values({
      id: noteId,
      ownerId: testUser.id,
      title: "Team offsite agenda",
      content: "Day 1: retro and planning. Day 2: hack day, demos at four.",
      isFavorite: true,
      updatedAt,
    });
  },
  async play({ canvas }) {
    await expect(await canvas.findByText("Favorite")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Unfavorite note" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
});

// A Server Action that deletes the note and redirects to the list.
export const Delete = meta.story({
  async beforeEach() {
    await db.insert(notes).values([
      { id: noteId, ownerId: testUser.id, title: "Short-lived", updatedAt },
      { ownerId: testUser.id, title: "Still here", updatedAt },
    ]);
  },
  async play({ canvas }) {
    await userEvent.click(await canvas.findByRole("button", { name: "Delete" }));
    await routeLoaded("/notes");
    await expect(await canvas.findByText("Still here")).toBeVisible();
    await expect(canvas.queryByText("Short-lived")).toBeNull();
  },
});

// The provider of next-themes in the root layout renders a script, which
// React warns about when it renders it in the browser. Next does that with
// the layouts of its not-found page, as with `next dev`. The warning is
// expected there, and only there.
function expectScriptTagWarning() {
  const error = console.error;
  spyOn(console, "error").mockImplementation((...data: unknown[]) => {
    if (!String(data[0]).startsWith("Encountered a script tag")) error(...data);
  });
}

// `notFound()` for an id that is not a UUID: Next's own not-found page.
export const InvalidId = meta.story({
  parameters: { nextjs: { url: "/notes/not-a-note" } },
  beforeEach: expectScriptTagWarning,
  async play({ canvas }) {
    await expect(await canvas.findByText("This page could not be found.")).toBeVisible();
  },
});

// Another user's note is not found either.
export const NotYours = meta.story({
  async beforeEach() {
    expectScriptTagWarning();
    await signInAs(otherUser);
    await db.insert(notes).values({ id: noteId, ownerId: otherUser.id, title: "Private" });
    await signInAs(testUser);
  },
  async play({ canvas }) {
    await expect(await canvas.findByText("This page could not be found.")).toBeVisible();
    await expect(canvas.queryByText("Private")).toBeNull();
  },
});
