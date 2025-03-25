import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('addon-a11y', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('should highlight the accessibility violations in the preview iframe', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.deepLinkToStory(storybookUrl, 'addons/a11y/tests', 'violations');
    await sbPage.viewAddonPanel('Accessibility');

    const panel = sbPage.panelContent();
    await panel.getByRole('button', { name: 'Show highlights' }).click();

    // check that the highlight is visible
    const imageElement = sbPage.previewIframe().getByRole('img');
    expect(await imageElement.evaluate((el) => getComputedStyle(el).outline)).toBe(
      'rgba(255, 68, 0, 0.6) solid 1px'
    );

    await page.getByRole('button', { name: 'Hide highlights' }).click();

    // check that the highlight is not visible
    expect(await imageElement.evaluate((el) => getComputedStyle(el).outline)).toBe(
      'rgb(0, 0, 0) none 0px'
    );
  });

  test('should rerun a11y checks when clicking the rerun button', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.deepLinkToStory(storybookUrl, 'addons/a11y/tests', 'violations');
    await sbPage.viewAddonPanel('Accessibility');

    const panel = sbPage.panelContent();
    await expect(panel.getByRole('tab', { name: 'Violations' })).toContainText('5');
    await sbPage.previewIframe().getByText('Toggle violation:').click();
    await panel.getByRole('button', { name: 'Rerun' }).click();
    await expect(panel.getByRole('tab', { name: 'Violations' })).toContainText('4');
  });

  test('should provide a deeplink code that can be used to navigate to a specific violation', async ({
    page,
  }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.deepLinkToStory(storybookUrl, 'addons/a11y/tests', 'violations');
    await sbPage.viewAddonPanel('Accessibility');

    const panel = sbPage.panelContent();
    await panel.getByRole('tab', { name: 'Passes' }).click();
    await panel.getByRole('button', { name: 'ARIA hidden element must not' }).click();
    await panel.getByRole('tab', { name: '1. <table aria-hidden="true"' }).click();
    await panel.getByRole('button', { name: 'Copy link' }).click();

    // test that clipboard contains the correct url
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    await expect(clipboard).toContain(
      'path=/story/addons-a11y-tests--violations&addonPanel=storybook/a11y/panel&a11ySelection=passes.aria-hidden-focus.1'
    );

    // navigate to that url
    await page.goto(clipboard);
    await new SbPage(page, expect).waitUntilLoaded();
    await expect(page.getByRole('tab', { name: 'Passes' })).toHaveAttribute('data-active', 'true');
    await expect(
      page.getByRole('button', { name: 'ARIA hidden element must not' })
    ).toHaveAttribute('data-active', 'true');
    const element = page.getByRole('tab', { name: '1. <table aria-hidden="true"' });
    await expect(element).toHaveAttribute('data-state', 'active');
  });
});
