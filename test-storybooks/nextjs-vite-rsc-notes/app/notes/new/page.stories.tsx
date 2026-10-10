import { expect, userEvent } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { routeLoaded } from "#.storybook/route.ts";
import { signInAs } from "#test/auth.ts";

// The form for a new note, with its Server Action: see
// app/notes/new/page.test.tsx.
const meta = preview.meta({
  title: "Pages/New note",
  parameters: { layout: "fullscreen", nextjs: { url: "/notes/new" } },
  async beforeEach() {
    await signInAs();
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByRole("heading", { level: 1, name: "New note" })).toBeVisible();
    await expect(canvas.getByLabelText("Title")).toHaveValue("");
    await expect(canvas.getByPlaceholderText("A short, scannable title")).toBeVisible();
  },
});

// The action flashes the errors and what was entered, and refreshes the page.
export const ValidationError = meta.story({
  async play({ canvas }) {
    await userEvent.type(await canvas.findByLabelText("Content"), "Keep this body");
    await userEvent.click(canvas.getByRole("button", { name: "Create note" }));

    await expect(await canvas.findByText("Title is required.")).toBeVisible();
    await expect(canvas.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByLabelText("Content")).toHaveValue("Keep this body");
  },
});

// The action inserts the note and redirects to its page.
export const Create = meta.story({
  async play({ canvas }) {
    await userEvent.type(await canvas.findByLabelText("Title"), "Groceries");
    await userEvent.type(canvas.getByLabelText("Content"), "Milk, eggs");
    await userEvent.click(canvas.getByRole("button", { name: "Create note" }));

    await routeLoaded(/^\/notes\/[0-9a-f-]{36}$/);
    await expect(await canvas.findByRole("heading", { level: 1, name: "Groceries" })).toBeVisible();
    await expect(canvas.getByText("Milk, eggs")).toBeVisible();
  },
});
