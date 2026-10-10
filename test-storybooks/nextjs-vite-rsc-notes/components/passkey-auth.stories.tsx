"use client";

import { expect } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { AddPasskeyButton, PasskeySignInButton } from "./passkey-auth.tsx";

// The buttons of Better Auth's passkeys, which check in an effect whether the
// browser has passkeys: what the sign-in and the profile page show.
const meta = preview.meta({
  title: "Components/Passkey",
  component: PasskeySignInButton,
  parameters: { layout: "centered" },
});

export const SignIn = meta.story({
  async play({ canvas }) {
    await expect(
      await canvas.findByRole("button", { name: "Sign in with a passkey" }),
    ).toBeEnabled();
  },
});

export const Add = meta.story({
  render: () => <AddPasskeyButton />,
  async play({ canvas }) {
    await expect(await canvas.findByRole("button", { name: /Add passkey/ })).toBeEnabled();
  },
});
