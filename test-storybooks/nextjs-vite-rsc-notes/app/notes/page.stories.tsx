import { eq } from "drizzle-orm";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { routeLoaded } from "#.storybook/route.ts";
import { sampleNotes, seedSampleNotes } from "#.storybook/sample-notes.ts";
import { notes } from "#db/schema.ts";
import { db } from "#lib/db.ts";
import { otherUser, signInAs, signOut, testUser } from "#test/auth.ts";

// The page at /notes, in the layouts of the app. A story file is server code,
// so the `db` it seeds is the one the page reads: see app/notes/page.test.tsx.
const meta = preview.meta({
  title: "Pages/Notes",
  parameters: { layout: "fullscreen", nextjs: { url: "/notes" } },
  async beforeEach() {
    await signInAs();
  },
});

export const Empty = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByRole("heading", { name: "Notes" })).toBeVisible();
    await expect(canvas.getByText("No notes yet")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Create your first note" })).toBeVisible();
  },
});

// A test of the story, in CSF Next: it runs after the play function.
Empty.test("links to the form for a new note", async ({ canvas }) => {
  await userEvent.click(canvas.getByRole("link", { name: "Create your first note" }));
  await routeLoaded("/notes/new");
  await expect(await canvas.findByRole("heading", { level: 1, name: "New note" })).toBeVisible();
});

export const WithNotes = meta.story({
  async beforeEach() {
    await seedSampleNotes(testUser.id);
  },
  async play({ canvas }) {
    for (const note of sampleNotes) {
      await expect(await canvas.findByText(note.title)).toBeVisible();
    }
    await expect(canvas.getByText("5 notes · 2 favorited")).toBeVisible();
  },
});

// The app's own theme toggle, in its header: the page in dark mode.
export const DarkMode = meta.story({
  async beforeEach() {
    await seedSampleNotes(testUser.id);
  },
  async play({ canvas }) {
    await userEvent.click(await canvas.findByRole("button", { name: "Toggle theme" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    await expect(canvas.getByText("Product roadmap Q3")).toBeVisible();
  },
});

export const FavoritesFirst = meta.story({
  async beforeEach() {
    await db.insert(notes).values([
      {
        ownerId: testUser.id,
        title: "Product roadmap Q3",
        isFavorite: true,
        updatedAt: new Date("2026-01-01"),
      },
      {
        ownerId: testUser.id,
        title: "Groceries",
        isFavorite: false,
        updatedAt: new Date("2026-03-01"),
      },
      {
        ownerId: testUser.id,
        title: "Team offsite agenda",
        isFavorite: true,
        updatedAt: new Date("2026-02-01"),
      },
    ]);
  },
  async play({ canvas }) {
    await canvas.findByText("Team offsite agenda");
    const titles = canvas
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    await expect(titles).toEqual(["Team offsite agenda", "Product roadmap Q3", "Groceries"]);
  },
});

export const OnlyOwnNotes = meta.story({
  async beforeEach() {
    await signInAs(otherUser);
    await signInAs(testUser);
    await db.insert(notes).values([
      { ownerId: testUser.id, title: "My reading list", content: "Visible to me" },
      { ownerId: otherUser.id, title: "Someone else's diary", content: "Hidden" },
    ]);
  },
  async play({ canvas }) {
    await expect(await canvas.findByText("My reading list")).toBeVisible();
    await expect(canvas.queryByText("Someone else's diary")).toBeNull();
  },
});

// A Server Action that writes to the database and refreshes the page.
export const ToggleFavorite = meta.story({
  async beforeEach() {
    await db.insert(notes).values({ ownerId: testUser.id, title: "Book recommendations" });
  },
  async play({ canvas }) {
    await userEvent.click(await canvas.findByRole("button", { name: "Favorite note" }));
    await expect(await canvas.findByRole("button", { name: "Unfavorite note" })).toBeVisible();
    const [note] = await db.select().from(notes).where(eq(notes.title, "Book recommendations"));
    await expect(note?.isFavorite).toBe(true);
  },
});

export const DeleteNote = meta.story({
  async beforeEach() {
    await db.insert(notes).values([
      { ownerId: testUser.id, title: "Team offsite agenda" },
      { ownerId: testUser.id, title: "Old meeting notes" },
    ]);
  },
  async play({ canvas }) {
    const row = within((await canvas.findByText("Old meeting notes")).closest("li")!);
    await userEvent.click(row.getByRole("button", { name: "Delete note" }));
    await waitFor(() => expect(canvas.queryByText("Old meeting notes")).toBeNull());
    await expect(canvas.getByText("Team offsite agenda")).toBeVisible();
    await expect(await db.select().from(notes)).toHaveLength(1);
  },
});

// proxy.ts is not there: `requireUser()` sends a visitor without a session to
// the sign-in page.
export const SignedOut = meta.story({
  beforeEach: signOut,
  async play({ canvas }) {
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Welcome back to Notes Demo" }),
    ).toBeVisible();
    await expect(window.location.pathname).toBe("/auth/sign-in");
  },
});
