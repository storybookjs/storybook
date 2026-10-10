import { expect, mocked, userEvent, within } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { auth } from "#lib/auth.ts";

// The sign-in page, with a Server Action that asks Better Auth for a magic
// link: lib/__mocks__/auth.ts answers. See app/auth/sign-in/page.test.tsx.
const meta = preview.meta({
  title: "Pages/Sign in",
  parameters: { layout: "fullscreen", nextjs: { url: "/auth/sign-in" } },
});

export const Default = meta.story({
  async play({ canvas }) {
    const heading = await canvas.findByRole("heading", {
      level: 1,
      name: "Welcome back to Notes Demo",
    });
    // In the Geist of next/font/google.
    await expect(getComputedStyle(heading).fontFamily).toContain("Geist");
    await expect(canvas.getByLabelText("Email")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Continue with email" })).toBeVisible();
    await expect(
      await canvas.findByRole("button", { name: "Sign in with a passkey" }),
    ).toBeVisible();
    await expect(
      within(canvas.getByRole("main")).getByRole("link", { name: "Sign up" }),
    ).toHaveAttribute("href", "/auth/sign-up");
  },
});

export const MagicLinkSent = meta.story({
  parameters: { nextjs: { url: "/auth/sign-in?sent=magic-link" } },
  async play({ canvas }) {
    await expect(await canvas.findByText("Check your inbox for the sign-in link.")).toBeVisible();
  },
});

export const MagicLinkError = meta.story({
  parameters: { nextjs: { url: "/auth/sign-in?error=magic" } },
  async play({ canvas }) {
    await expect(
      await canvas.findByText("We couldn’t send your sign-in link. Please try again."),
    ).toBeVisible();
  },
});

// The action validates the email, and flashes the error with what was entered.
export const InvalidEmail = meta.story({
  async play({ canvas }) {
    await userEvent.type(await canvas.findByLabelText("Email"), "not-an-email");
    await userEvent.click(canvas.getByRole("button", { name: "Continue with email" }));

    await expect(await canvas.findByText("Enter a valid email address.")).toBeVisible();
    await expect(canvas.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByLabelText("Email")).toHaveValue("not-an-email");
  },
});

// The action sends the link and redirects to the page that says so.
export const SendMagicLink = meta.story({
  async play({ canvas }) {
    await userEvent.type(await canvas.findByLabelText("Email"), "ada@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Continue with email" }));

    await expect(await canvas.findByText("Check your inbox for the sign-in link.")).toBeVisible();
    await expect(auth.api.signInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ email: "ada@example.com" }) }),
    );
  },
});

// Better Auth fails to send the link: the page says so.
export const SendMagicLinkFails = meta.story({
  async beforeEach() {
    mocked(auth.api.signInMagicLink).mockRejectedValue(new Error("Email service is down"));
  },
  async play({ canvas }) {
    await userEvent.type(await canvas.findByLabelText("Email"), "ada@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Continue with email" }));

    await expect(
      await canvas.findByText("We couldn’t send your sign-in link. Please try again."),
    ).toBeVisible();
    await expect(window.location.search).toBe("?error=magic");
  },
});
