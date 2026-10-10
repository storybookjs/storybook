import { expect, screen, userEvent, waitFor } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { NextActionProtocolProbe } from "./next-action-protocol-probe.tsx";

// Server Actions that a Server Component hands to a Client Component, which
// calls them: see next-action-protocol.test.tsx.
const meta = preview.meta({
  title: "Probes/NextActionProtocolProbe",
  component: NextActionProtocolProbe,
});

// The action redirects to another route of the app, which Next's router
// loads as a page: the document, where `screen` looks.
export const RedirectAction = meta.story({
  async play({ canvas }) {
    await userEvent.click(await canvas.findByRole("button", { name: "Capture redirect action" }));

    // Once the page has loaded: it has a `<body>` of its own.
    await waitFor(
      () =>
        expect(window.location.pathname + window.location.search).toBe("/auth/sign-in?from=action"),
      { timeout: 10_000 },
    );
    await expect(
      await screen.findByRole("heading", { level: 1, name: "Welcome back to Notes Demo" }),
    ).toBeVisible();
    // The page with the layouts of the app.
    await expect(screen.getByRole("banner")).toBeVisible();
    // Once the page has hydrated: its passkey button checks for support then.
    await expect(
      await screen.findByRole("button", { name: "Sign in with a passkey" }),
    ).toBeVisible();
  },
});
