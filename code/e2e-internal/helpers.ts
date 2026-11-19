import { expect, type Page } from '@playwright/test';

/** Internal Storybook UI can take a while to compile the first preview story on cold start. */
export const PREVIEW_STORY_TIMEOUT = 30_000;

/** Waits until the manager preview shell has finished loading the selected story. */
export async function waitForPreviewReady(page: Page): Promise<void> {
  await expect(page.getByRole('progressbar', { name: 'Content is loading...' })).toBeHidden({
    timeout: PREVIEW_STORY_TIMEOUT,
  });
}

/**
 * Drops the snippets the preview sends the manager, from the next page load on, so the Code panel
 * shows only what the manager fills itself.
 */
export async function dropPreviewSnippets(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window !== window.top) {
      return;
    }
    const addEventListener = window.addEventListener.bind(window);
    window.addEventListener = ((type: string, listener: EventListener, options?: unknown) =>
      addEventListener(
        type,
        type === 'message'
          ? (event: Event) => {
              const { data } = event as MessageEvent;
              if (!(typeof data === 'string' && data.includes('storybook/docs/snippet-rendered'))) {
                listener(event);
              }
            }
          : listener,
        options as AddEventListenerOptions
      )) as typeof window.addEventListener;
  });
}
