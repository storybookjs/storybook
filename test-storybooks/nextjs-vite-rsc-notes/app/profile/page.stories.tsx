import { expect, mocked, userEvent } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { routeLoaded } from "#.storybook/route.ts";
import { auth } from "#lib/auth.ts";
import { signInAs, signOut, testUser } from "#test/auth.ts";

// The profile page, which asks Better Auth for the passkeys: lib/__mocks__/auth.ts
// answers. See app/profile/page.test.tsx.
const meta = preview.meta({
  title: "Pages/Profile",
  parameters: { layout: "fullscreen", nextjs: { url: "/profile" } },
  async beforeEach() {
    await signInAs();
  },
});

export const NoPasskeys = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
    await expect(canvas.getByText(`Signed in as ${testUser.email}.`)).toBeVisible();
    await expect(canvas.getByText("No passkeys yet")).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Add passkey/ })).toBeVisible();
  },
});

export const WithPasskeys = meta.story({
  async beforeEach() {
    mocked(auth.api.listPasskeys).mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "iPhone passkey",
        createdAt: new Date("2026-02-14T10:00:00.000Z"),
        publicKey: "pk1",
        userId: testUser.id,
        credentialID: "credential-1",
        counter: 0,
        deviceType: "singleDevice",
        backedUp: true,
        transports: "internal",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Work laptop",
        createdAt: new Date("2026-03-20T10:00:00.000Z"),
        publicKey: "pk2",
        userId: testUser.id,
        credentialID: "credential-2",
        counter: 0,
        deviceType: "multiDevice",
        backedUp: true,
        transports: "internal",
      },
    ]);
  },
  async play({ canvas }) {
    await expect(await canvas.findByText("iPhone passkey")).toBeVisible();
    await expect(canvas.getByText("Added Feb 14, 2026")).toBeVisible();
    await expect(canvas.getByText("Work laptop")).toBeVisible();
    await expect(canvas.getByText("Added Mar 20, 2026")).toBeVisible();
  },
});

// After the first sign-in, Better Auth sends a new user here.
export const PasskeySetup = meta.story({
  parameters: { nextjs: { url: "/profile?setup=passkey" } },
  async play({ canvas }) {
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Add a passkey" }),
    ).toBeVisible();
    await expect(canvas.getByText("Your account is ready.")).toBeVisible();
  },
});

// The Server Action signs out with Better Auth and redirects to sign in.
export const SignOut = meta.story({
  async play({ canvas }) {
    mocked(auth.api.signOut).mockImplementation(async () => {
      signOut();
      return { success: true };
    });
    await userEvent.click(await canvas.findByRole("button", { name: "Sign out" }));

    await routeLoaded("/auth/sign-in");
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Welcome back to Notes Demo" }),
    ).toBeVisible();
    await expect(auth.api.signOut).toHaveBeenCalledOnce();
  },
});

export const SignedOut = meta.story({
  beforeEach: signOut,
  async play({ canvas }) {
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Welcome back to Notes Demo" }),
    ).toBeVisible();
  },
});
