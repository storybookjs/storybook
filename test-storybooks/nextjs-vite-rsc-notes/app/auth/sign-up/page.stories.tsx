import { expect, userEvent, within } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { auth } from "#lib/auth.ts";

// The sign-up page: see app/auth/sign-up/page.test.tsx.
const meta = preview.meta({
  title: "Pages/Sign up",
  parameters: { layout: "fullscreen", nextjs: { url: "/auth/sign-up" } },
});

export const Default = meta.story({
  async play({ canvas }) {
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Welcome to Notes Demo" }),
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Create account" })).toBeVisible();
    // Sign-up is email only: no passkey, and no "Or".
    await expect(canvas.queryByRole("button", { name: "Sign in with a passkey" })).toBeNull();
    await expect(canvas.queryByText("Or", { exact: true })).toBeNull();
    await expect(
      within(canvas.getByRole("main")).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/auth/sign-in");
  },
});

export const InvalidEmail = meta.story({
  async play({ canvas }) {
    await userEvent.type(await canvas.findByLabelText("Email"), "not-an-email");
    await userEvent.click(canvas.getByRole("button", { name: "Create account" }));

    await expect(await canvas.findByText("Enter a valid email address.")).toBeVisible();
    await expect(canvas.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByLabelText("Email")).toHaveValue("not-an-email");
  },
});

export const MagicLinkSent = meta.story({
  parameters: { nextjs: { url: "/auth/sign-up?sent=magic-link" } },
  async play({ canvas }) {
    await expect(
      await canvas.findByText("Check your inbox for the link to finish creating your account."),
    ).toBeVisible();
  },
});

export const CreateAccount = meta.story({
  async play({ canvas }) {
    await userEvent.type(await canvas.findByLabelText("Email"), "grace@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Create account" }));

    await expect(
      await canvas.findByText("Check your inbox for the link to finish creating your account."),
    ).toBeVisible();
    await expect(auth.api.signInMagicLink).toHaveBeenCalledOnce();
  },
});
