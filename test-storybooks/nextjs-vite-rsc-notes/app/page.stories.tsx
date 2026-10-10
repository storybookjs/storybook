import { expect, userEvent } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { routeLoaded } from "#.storybook/route.ts";
import { signInAs, testUser } from "#test/auth.ts";

// The home page, in the root layout, whose header knows who is signed in.
const meta = preview.meta({
  title: "Pages/Home",
  parameters: { layout: "fullscreen", nextjs: { url: "/" } },
});

// /notes sends a visitor without a session to sign in: `requireUser()`.
export const SignedOut = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByRole("link", { name: "Log in" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Sign up" })).toBeVisible();

    await userEvent.click(canvas.getByRole("link", { name: "Open notes" }));
    await routeLoaded("/auth/sign-in");
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Welcome back to Notes Demo" }),
    ).toBeVisible();
  },
});

export const SignedIn = meta.story({
  async beforeEach() {
    await signInAs();
  },
  async play({ canvas }) {
    await expect(
      await canvas.findByRole("link", { name: `Signed in as ${testUser.email}, open profile` }),
    ).toBeVisible();

    await userEvent.click(canvas.getByRole("link", { name: "Open notes" }));
    await routeLoaded("/notes");
    await expect(await canvas.findByRole("heading", { level: 1, name: "Notes" })).toBeVisible();
  },
});
