import { expect, userEvent, waitFor } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { ClientRefreshProbe } from "./client-refresh-probe.tsx";
import {
  readServerRefreshProbe,
  resetServerRefreshProbe,
  ServerRefreshProbe,
} from "./server-refresh-probe.tsx";

// A Server Action that counts on the server, with and without `refresh()`,
// and `router.refresh()` from a Client Component: see next-router.test.tsx.
const meta = preview.meta({
  title: "Probes/ServerRefreshProbe",
  component: ServerRefreshProbe,
  args: { shouldRefresh: true },
  beforeEach() {
    resetServerRefreshProbe();
  },
});

export const WithRefresh = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByText("server count: 0")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Increment" }));
    await expect(await canvas.findByText("server count: 1")).toBeVisible();
  },
});

// Without `refresh()` the page keeps what it rendered, until the router of
// the client refreshes it.
export const RouterRefresh = meta.story({
  args: { shouldRefresh: false },
  render: (args) => (
    <>
      <ServerRefreshProbe {...args} />
      <ClientRefreshProbe />
    </>
  ),
  async play({ canvas }) {
    await expect(await canvas.findByText("server count: 0")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Increment" }));
    await waitFor(() => expect(readServerRefreshProbe()).toBe(1));
    await expect(canvas.getByText("server count: 0")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Refresh router" }));
    await expect(await canvas.findByText("server count: 1")).toBeVisible();
  },
});
