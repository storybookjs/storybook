// Slim Playwright helpers for verify-recipes. Self-contained: no imports from
// code/e2e-tests/util.ts (which transitively pulls TS enums via cli-storybook).
// Recipes here are evaluated by Playwright's Node test workers, so anything
// that requires non-erasable TS is off-limits.

import type { Expect, FrameLocator, Locator, Page } from '@playwright/test';

export class RecipePage {
  readonly page: Page;
  readonly expect: Expect;

  constructor(page: Page, expect: Expect) {
    this.page = page;
    this.expect = expect;
  }

  previewIframe(): FrameLocator {
    return this.page.frameLocator('#storybook-preview-iframe');
  }

  previewRoot(): Locator {
    return this.previewIframe().locator('#storybook-root:visible, #storybook-docs:visible');
  }

  async waitForStoryLoaded(): Promise<void> {
    await this.page.waitForURL((url) => url.search.includes('path'));
    const root = this.previewRoot();
    await root.locator(':scope > *').first().waitFor({ state: 'attached', timeout: 10_000 });
  }

  async waitUntilLoaded(): Promise<void> {
    await this.page.context().addInitScript(() => {
      const storeState = {
        layout: { showToolbar: true, navSize: 300, bottomPanelHeight: 300, rightPanelWidth: 300 },
      };
      window.sessionStorage.setItem('@storybook/manager/store', JSON.stringify(storeState));
    }, {});

    await this.page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; }`,
    });

    const root = this.previewRoot();
    await root.locator('.sb-preparing-docs').waitFor({ state: 'hidden' });
    await root.locator('.sb-preparing-story').waitFor({ state: 'hidden' });
    await this.waitForStoryLoaded();
  }
}
