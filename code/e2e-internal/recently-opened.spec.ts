import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from '../e2e-sandbox/util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

test.describe('recently opened', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${storybookUrl}?path=/story/example-button--primary`);
    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();
    await sbPage.navigateToStory('example/button', 'large');
    await sbPage.navigateToStory('core/args', 'targets');
  });

  test('the clock button lists the opened stories and reopens them', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    const recentlyOpened = page.getByRole('switch', { name: 'Recently opened' });
    const options = page.getByRole('option');

    await recentlyOpened.click();
    await expect(recentlyOpened).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('searchbox')).not.toBeFocused();
    await expect(page.getByRole('listbox', { name: 'Recently opened' })).toBeVisible();
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveAccessibleName('args / Targets core');
    await expect(options.nth(1)).toHaveAccessibleName('Button / Large Example');
    await expect(options.nth(2)).toHaveAccessibleName('Button / Primary Example');

    await options.nth(1).click();
    await page.waitForURL((url) => url.search.includes('path=/story/example-button--large'));
    await expect(recentlyOpened).toHaveAttribute('aria-checked', 'true');
    await expect(options.nth(0)).toHaveAccessibleName('Button / Large Example');

    await recentlyOpened.click();
    await expect(recentlyOpened).toHaveAttribute('aria-checked', 'false');
    await expect(options).toHaveCount(0);
    await expect(sbPage.sidebarRow('example-button--large')).toHaveAttribute(
      'data-selected',
      'true'
    );
  });

  test('typing searches the recently opened stories only', async ({ page }) => {
    const recentlyOpened = page.getByRole('switch', { name: 'Recently opened' });
    const searchbox = page.getByRole('searchbox');
    const options = page.getByRole('option');

    await recentlyOpened.click();
    await searchbox.fill('primary');
    await expect(options).toHaveCount(1);
    await expect(options.first()).toHaveAccessibleName('Button / Primary Example');

    await recentlyOpened.click();
    await expect(options.nth(1)).toBeVisible();

    await recentlyOpened.click();
    await searchbox.fill('zzz');
    await expect(page.getByText('No recently opened items found')).toBeVisible();
  });

  test('Escape closes the recently opened view', async ({ page }) => {
    const recentlyOpened = page.getByRole('switch', { name: 'Recently opened' });

    await recentlyOpened.click();
    await expect(page.getByRole('option')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(recentlyOpened).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('option')).toHaveCount(0);
  });
});
