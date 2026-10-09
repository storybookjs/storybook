import { expect, userEvent } from "storybook/test";
import preview from "#.storybook/preview.ts";
import FlashCookieProbe from "./flash-cookie-probe.tsx";

// A Server Component that reads the headers and the cookies of its request,
// with Server Actions that set and delete a cookie: see
// flash-cookie-probe.test.tsx.
const meta = preview.meta({
  title: "Probes/FlashCookieProbe",
  component: FlashCookieProbe,
  parameters: {
    nextjs: { headers: { "x-test-request": "from-story", cookie: "flash=initial" } },
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByText("request id: from-story")).toBeVisible();
    await expect(canvas.getByText("flash: initial")).toBeVisible();
    await expect(canvas.getByText("has flash: true")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Set flash" }));
    await expect(await canvas.findByText("flash: saved")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Delete flash" }));
    await expect(await canvas.findByText("flash: empty")).toBeVisible();
  },
});
