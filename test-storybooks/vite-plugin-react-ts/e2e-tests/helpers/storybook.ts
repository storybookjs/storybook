import { type APIRequestContext, expect } from '@playwright/test';

/** Waits until the embedded dev server answers the Storybook index, e.g. after a host restart. */
export async function waitForStorybookIndex(request: APIRequestContext): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          const response = await request.get('/__storybook/index.json');
          return response.ok();
        } catch {
          return false;
        }
      },
      { timeout: 30_000 }
    )
    .toBe(true);
}
