"use client";

import { expect, fn, userEvent, waitFor } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { SubmitButton } from "./submit-button.tsx";

// A story file with `"use client"`: an arg can be a function, like a spy that
// the play function asserts on, and the form's action is a function of the
// browser. The button reads the status of its form with `useFormStatus()`.
const meta = preview.type<{ args: { onSave: () => void } }>().meta({
  title: "Components/SubmitButton",
  component: SubmitButton,
  args: { children: "Save note", onSave: fn() },
  render: ({ onSave, ...args }) => (
    <form
      action={async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        onSave();
      }}
    >
      <SubmitButton {...args} />
    </form>
  ),
});

export const Pending = meta.story({
  async play({ args, canvas }) {
    const button = await canvas.findByRole("button", { name: "Save note" });
    await userEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    await expect(button).toBeDisabled();
    await waitFor(() => expect(args.onSave).toHaveBeenCalledOnce());
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"));
  },
});

// A test of a story of a file with `"use client"`: it renders in the browser
// too.
Pending.test("can be pressed again once the action is done", async ({ args, canvas }) => {
  const button = canvas.getByRole("button", { name: "Save note" });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  await waitFor(() => expect(args.onSave).toHaveBeenCalledTimes(2));
});

export const Disabled = meta.story({
  args: { disabled: true },
  async play({ canvas }) {
    await expect(await canvas.findByRole("button", { name: "Save note" })).toBeDisabled();
  },
});
