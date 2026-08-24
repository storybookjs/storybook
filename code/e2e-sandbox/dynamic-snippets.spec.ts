import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

const DECLARED_LABEL = 'declaredLabel';
const TYPED_LABEL = 'typedLabel';
const FIRST_TAB_LABEL = 'firstTabLabel';
const SECOND_TAB_LABEL = 'secondTabLabel';

test.describe('dynamic snippets', () => {
  // Only `angular-vite` registers a snippet-template renderer today, and only its docgen-server
  // template turns the flag on. Everywhere else the snippet is still static by design, so asserting
  // a change would be asserting a bug.
  test.skip(
    !templateName.includes('angular-vite/docgen-server'),
    `Skipping ${templateName}: dynamic snippets are Angular-only behind experimentalDocgenServer.`
  );

  test('the Code panel snippet follows a Controls knob', async ({ page }) => {
    await page.goto(storybookUrl);
    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();
    await sbPage.navigateToStory('stories/frameworks/angular-vite/dynamic-snippets', 'default');

    await sbPage.viewAddonPanel('Code');
    const codePanel = sbPage.panelContent();
    await expect(codePanel).toContainText(`[label]="'${DECLARED_LABEL}'"`);

    await sbPage.viewAddonPanel('Controls');
    await sbPage.panelContent().locator('textarea[name=label]').fill(TYPED_LABEL);
    await expect(sbPage.previewRoot().locator('button')).toContainText(TYPED_LABEL);

    await sbPage.viewAddonPanel('Code');
    await expect(codePanel).toContainText(`[label]="'${TYPED_LABEL}'"`);
    await expect(codePanel).not.toContainText(`[label]="'${DECLARED_LABEL}'"`);
  });

  test('the docs Source block follows a Controls knob', async ({ page }) => {
    await page.goto(storybookUrl);
    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();
    await sbPage.navigateToStory(
      'stories/frameworks/angular-vite/dynamic-snippets',
      'docs',
      'docs'
    );

    const root = sbPage.previewRoot();
    await expect(root.locator('pre.prismjs').first()).toContainText(
      `[label]="'${DECLARED_LABEL}'"`
    );

    await root.locator('textarea[name=label]').fill(TYPED_LABEL);

    await expect(root.locator('pre.prismjs').first()).toContainText(`[label]="'${TYPED_LABEL}'"`);
  });

  test('dynamic snippets stay isolated between browser tabs', async ({ context, page }) => {
    await page.goto(storybookUrl);
    const firstStorybook = new SbPage(page, expect);
    await firstStorybook.waitUntilLoaded();
    await firstStorybook.navigateToStory(
      'stories/frameworks/angular-vite/dynamic-snippets',
      'default'
    );

    const secondPage = await context.newPage();
    await secondPage.goto(storybookUrl);
    const secondStorybook = new SbPage(secondPage, expect);
    await secondStorybook.waitUntilLoaded();
    await secondStorybook.navigateToStory(
      'stories/frameworks/angular-vite/dynamic-snippets',
      'default'
    );

    await firstStorybook.viewAddonPanel('Controls');
    await firstStorybook.panelContent().locator('textarea[name=label]').fill(FIRST_TAB_LABEL);
    await expect(firstStorybook.previewRoot().locator('button')).toContainText(FIRST_TAB_LABEL);

    await secondStorybook.viewAddonPanel('Controls');
    await secondStorybook.panelContent().locator('textarea[name=label]').fill(SECOND_TAB_LABEL);
    await expect(secondStorybook.previewRoot().locator('button')).toContainText(SECOND_TAB_LABEL);

    await firstStorybook.viewAddonPanel('Code');
    await expect(firstStorybook.panelContent()).toContainText(`[label]="'${FIRST_TAB_LABEL}'"`);
    await expect(firstStorybook.panelContent()).not.toContainText(SECOND_TAB_LABEL);

    await secondStorybook.viewAddonPanel('Code');
    await expect(secondStorybook.panelContent()).toContainText(`[label]="'${SECOND_TAB_LABEL}'"`);
    await expect(secondStorybook.panelContent()).not.toContainText(FIRST_TAB_LABEL);
  });
});
