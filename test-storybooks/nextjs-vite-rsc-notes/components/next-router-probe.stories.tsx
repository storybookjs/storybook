"use client";

import { expect, screen, userEvent, waitFor } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { NextRouterProbe } from "./next-router-probe.tsx";

// A story file with `"use client"`: the probe renders in the browser, in
// Next's own router, at the URL of the story. The params are the ones the
// app's route for that URL has. See next-router.test.tsx.
const meta = preview.meta({
  title: "Probes/NextRouterProbe",
  component: NextRouterProbe,
  parameters: { nextjs: { url: "/notes/123/edit?q=first&q=second" } },
});

export const RouteParams = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByText("pathname: /notes/123/edit")).toBeVisible();
    await expect(canvas.getByText("search q: first")).toBeVisible();
    await expect(canvas.getByText("search q all: first,second")).toBeVisible();
    await expect(canvas.getByText('params: {"id":"123"}')).toBeVisible();
  },
});

// `router.push()` and `router.replace()` change the search params of the URL.
export const Search = meta.story({
  parameters: { nextjs: { url: "/notes/123?q=test" } },
  async play({ canvas }) {
    await userEvent.click(await canvas.findByRole("button", { name: "Push search" }));
    await expect(await canvas.findByText("search q: pushed")).toBeVisible();
    await expect(window.location.search).toBe("?q=pushed");

    await userEvent.click(canvas.getByRole("button", { name: "Replace search" }));
    await expect(await canvas.findByText("search q: replaced")).toBeVisible();
    await expect(window.location.search).toBe("?q=replaced");
    await expect(canvas.getByText('params: {"id":"123"}')).toBeVisible();
  },
});

// A link to another route of the app loads its page: the document, where
// `screen` looks.
export const LinkToAnotherRoute = meta.story({
  parameters: { nextjs: { url: "/notes/123" } },
  async play({ canvas }) {
    await userEvent.click(await canvas.findByRole("link", { name: "Link route" }));

    // Once the page has loaded: it has a `<body>` of its own.
    await waitFor(() => expect(window.location.pathname).toBe("/auth/sign-in"), {
      timeout: 10_000,
    });
    await expect(
      await screen.findByRole("heading", { level: 1, name: "Welcome back to Notes Demo" }),
    ).toBeVisible();
    // Once the page has hydrated: its passkey button checks for support then.
    await expect(
      await screen.findByRole("button", { name: "Sign in with a passkey" }),
    ).toBeVisible();
  },
});
