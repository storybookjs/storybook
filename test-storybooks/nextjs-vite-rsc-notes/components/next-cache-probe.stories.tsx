import { expect, userEvent } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { NextCacheProbe, resetNextCacheProbe } from "./next-cache-probe.tsx";

// Next's Data Cache, seen through a probe: `unstable_cache`, cached and
// uncached `fetch`, and the Server Actions that refresh and revalidate. The
// service it fetches from is MSW, which .storybook/preview.ts starts. See
// next-cache.test.tsx.
const meta = preview.meta({
  title: "Probes/NextCacheProbe",
  component: NextCacheProbe,
  beforeEach() {
    resetNextCacheProbe();
  },
});

// A cache scope's timestamps are in milliseconds: an invalidation in the
// same millisecond as the entry does not count.
const pastCacheTimestamp = () => new Promise((resolve) => setTimeout(resolve, 5));

export const Refresh = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByText("render: 1")).toBeVisible();
    await expect(canvas.getByText("cached data: default data 1")).toBeVisible();
    await expect(canvas.getByText("cached fetch: default fetch 1")).toBeVisible();
    // Two requests for the same URL in one render are one.
    await expect(canvas.getByText("cached fetch duplicate: default fetch 1")).toBeVisible();
    await expect(canvas.getByText("no-store fetch: default no-store fetch 1")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: /^Refresh$/ }));

    await expect(await canvas.findByText("render: 2")).toBeVisible();
    await expect(canvas.getByText("cached data: default data 1")).toBeVisible();
    await expect(canvas.getByText("cached fetch: default fetch 1")).toBeVisible();
    await expect(canvas.getByText("no-store fetch: default no-store fetch 2")).toBeVisible();
  },
});

export const WriteAndRefresh = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByText("action writes: 0")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Write and refresh" }));

    await expect(await canvas.findByText("render: 2")).toBeVisible();
    await expect(canvas.getByText("action writes: 1")).toBeVisible();
    await expect(canvas.getByText("cached data: default data 1")).toBeVisible();
  },
});

export const UpdateTags = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByText("cached data: default data 1")).toBeVisible();
    await pastCacheTimestamp();
    await userEvent.click(canvas.getByRole("button", { name: "Update data tag" }));
    await expect(await canvas.findByText("cached data: default data 2")).toBeVisible();
    await expect(canvas.getByText("cached fetch: default fetch 1")).toBeVisible();

    await pastCacheTimestamp();
    await userEvent.click(canvas.getByRole("button", { name: "Update fetch tag" }));
    await expect(await canvas.findByText("cached fetch: default fetch 2")).toBeVisible();
    await expect(canvas.getByText("cached data: default data 2")).toBeVisible();
  },
});

export const ExpireDataTag = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByText("cached data: default data 1")).toBeVisible();
    await pastCacheTimestamp();
    await userEvent.click(canvas.getByRole("button", { name: "Expire data tag" }));

    await expect(await canvas.findByText("render: 2")).toBeVisible();
    await expect(canvas.getByText("cached data: default data 2")).toBeVisible();
    await expect(canvas.getByText("cached fetch: default fetch 1")).toBeVisible();
  },
});

export const RevalidatePath = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByText("cached data: default data 1")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Revalidate current path" }));

    await expect(await canvas.findByText("render: 2")).toBeVisible();
    await expect(canvas.getByText("action writes: 1")).toBeVisible();
    await expect(canvas.getByText("cached data: default data 2")).toBeVisible();
    await expect(canvas.getByText("cached fetch: default fetch 2")).toBeVisible();
  },
});
