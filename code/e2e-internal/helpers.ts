import { expect, type Page } from '@playwright/test';

/** Internal Storybook UI can take a while to compile the first preview story on cold start. */
export const PREVIEW_STORY_TIMEOUT = 30_000;

/** Waits until the manager preview shell has finished loading the selected story. */
export async function waitForPreviewReady(page: Page): Promise<void> {
  await expect(page.getByRole('progressbar', { name: 'Content is loading...' })).toBeHidden({
    timeout: PREVIEW_STORY_TIMEOUT,
  });
}
