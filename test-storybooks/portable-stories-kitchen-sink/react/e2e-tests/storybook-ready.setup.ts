import { chromium } from "@playwright/test";

// Global setup (playwright-e2e.config.ts), which Playwright runs once the `webServer` answers:
// renders one story before the tests start, so the dev server's first compile of the preview does
// not count against the first test's 10-second wait for a story (SbPage.waitForStoryLoaded). As
// code/e2e-sandbox/storybook.setup.ts does for the sandboxes. A global setup, not a setup project,
// because each CI shard picks its tests with `--grep`.
const STORYBOOK_URL = "http://localhost:6006";
const READY_TIMEOUT = 200_000;

export default async function storybookReady() {
  const deadline = Date.now() + READY_TIMEOUT;
  let story: string | undefined;
  while (!story) {
    const index = await fetch(`${STORYBOOK_URL}/index.json`)
      .then((response) => (response.ok ? response.json() : undefined))
      .catch(() => undefined);
    story = Object.values<{ id: string; type: string }>(index?.entries ?? {}).find(
      (entry) => entry.type === "story"
    )?.id;
    if (!story) {
      if (Date.now() > deadline) {
        throw new Error(`Storybook's index.json at ${STORYBOOK_URL} listed no story in time.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${STORYBOOK_URL}/iframe.html?id=${story}&viewMode=story`, {
      timeout: READY_TIMEOUT,
    });
    await page
      .locator("#storybook-root > *")
      .first()
      .waitFor({ state: "attached", timeout: Math.max(deadline - Date.now(), 1000) });
  } finally {
    await browser.close();
  }
}
