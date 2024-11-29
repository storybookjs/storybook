import { toId } from '@storybook/csf';

import type { Expect, Page } from '@playwright/test';

import { allTemplates } from '../lib/cli-storybook/src/sandbox-templates';

export class SbPage {
  readonly page: Page;

  readonly expect: Expect;

  constructor(page: Page, expect: Expect) {
    this.page = page;
    this.expect = expect;
  }

  async openComponent(title: string, hasRoot = true) {
    const parts = title.split('/');
    for (let i = hasRoot ? 1 : 0; i < parts.length; i += 1) {
      const parentId = toId(parts.slice(0, i + 1).join('/'));

      const parentLink = this.page.locator(`#${parentId}`);

      await this.expect(parentLink).toBeVisible();
      if ((await parentLink.getAttribute('aria-expanded')) === 'false') {
        await parentLink.click();
      }
    }
  }

  /** Visit a story via the URL instead of selecting from the sidebar. */
  async deepLinkToStory(baseURL: string, title: string, name: 'docs' | string) {
    const titleId = toId(title);
    const storyId = toId(name);
    const storyLinkId = `${titleId}--${storyId}`;
    const viewMode = name === 'docs' ? 'docs' : 'story';
    await this.page.goto(`${baseURL}/?path=/${viewMode}/${storyLinkId}`);

    await this.page.waitForURL((url) => url.search.includes(`path=/${viewMode}/${storyLinkId}`));
    await this.previewRoot();
  }

  /** Visit a story by selecting it from the sidebar. */
  async navigateToStory(title: string, name: string, viewMode?: 'docs' | 'story') {
    await this.openComponent(title);

    const titleId = toId(title);
    const storyId = toId(name);
    const storyLinkId = `#${titleId}--${storyId}`;
    await this.page.locator(storyLinkId).waitFor();
    const storyLink = this.page.locator('*', { has: this.page.locator(`> ${storyLinkId}`) });
    await storyLink.click();

    await this.page.waitForURL((url) =>
      url.search.includes(
        `path=/${(viewMode ?? name === 'docs') ? 'docs' : 'story'}/${titleId}--${storyId}`
      )
    );

    const selected = storyLink;
    await this.expect(selected).toHaveAttribute('data-selected', 'true');

    await this.previewRoot();
  }

  async navigateToUnattachedDocs(title: string, name = 'docs') {
    await this.openComponent(title);

    const titleId = toId(title);
    const storyId = toId(name);
    const storyLinkId = `#${titleId}-${storyId}--docs`;
    await this.page.locator(storyLinkId).waitFor();
    const storyLink = this.page.locator('*', { has: this.page.locator(`> ${storyLinkId}`) });
    await storyLink.click();

    await this.page.waitForURL((url) =>
      url.search.includes(`path=/docs/${titleId}-${storyId}--docs`)
    );

    const selected = storyLink;
    await this.expect(selected).toHaveAttribute('data-selected', 'true');

    await this.previewRoot();
  }

  async waitUntilLoaded() {
    // make sure we start every test with clean state – to avoid possible flakiness
    await this.page.context().addInitScript(() => {
      const storeState = {
        layout: {
          showToolbar: true,
          navSize: 300,
          bottomPanelHeight: 300,
          rightPanelWidth: 300,
        },
      };
      window.sessionStorage.setItem('@storybook/manager/store', JSON.stringify(storeState));
    }, {});

    // disable all transitions to avoid flakiness
    await this.page.addStyleTag({
      content: `
            *,
            *::before,
            *::after {
              transition: none !important;
            }
          `,
    });
    const root = this.previewRoot();
    const docsLoadingPage = root.locator('.sb-preparing-docs');
    const storyLoadingPage = root.locator('.sb-preparing-story');
    await docsLoadingPage.waitFor({ state: 'hidden' });
    await storyLoadingPage.waitFor({ state: 'hidden' });
  }

  previewIframe() {
    return this.page.frameLocator('#storybook-preview-iframe');
  }

  previewRoot() {
    const preview = this.previewIframe();
    return preview.locator('#storybook-root:visible, #storybook-docs:visible');
  }

  panelContent() {
    return this.page.locator('#storybook-panel-root #panel-tab-content > div:not([hidden])');
  }

  async viewAddonPanel(name: string) {
    const tabs = this.page.locator('[role=tablist] button[role=tab]');
    const tab = tabs.locator(`text=/^${name}/`);
    await tab.click();
  }

  async selectToolbar(toolbarSelector: string, itemSelector?: string) {
    await this.page.locator(toolbarSelector).click();
    if (itemSelector) {
      await this.page.locator(itemSelector).click();
    }
  }

  getCanvasBodyElement() {
    return this.previewIframe().locator('body');
  }
}

const templateName: keyof typeof allTemplates = process.env.STORYBOOK_TEMPLATE_NAME || ('' as any);

const templates = allTemplates;
export const hasVitestIntegration =
  !templates[templateName]?.skipTasks?.includes('vitest-integration');
