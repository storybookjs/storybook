import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

const DECLARED_LABEL = 'declaredLabel';
const TYPED_LABEL = 'typedLabel';

/**
 * The snippet in the Code panel and the docs Source block follows the Controls.
 *
 * The rest of the suite asserts a snippet *renders*; this is the only place that asserts it
 * *changes*. It runs unchanged against the dev server and against a built Storybook served with no
 * dev server behind it, because "works in dev only" was never the deliverable.
 */
test.describe('dynamic snippets', () => {
  // Only `angular-vite` registers a snippet-recipe renderer today, and only its docgen-server
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
});
