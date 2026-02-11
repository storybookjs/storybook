import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME;
const type = process.env.STORYBOOK_TYPE || 'dev';

test.describe('Manager UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);

    await new SbPage(page, expect).waitUntilLoaded();
  });

  test.describe('Desktop', () => {
    // TODO: test dragging and resizing

    test('Settings tooltip', async ({ page }) => {
      await page.locator('[aria-label="Settings"]').click();

      // should only hide if pressing Escape, and not other keyboard inputs
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('A');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();

      // should also hide if clicking anywhere outside the tooltip
      await page.locator('[aria-label="Settings"]').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.click('body');
      await expect(page.getByRole('dialog')).toBeHidden();
    });

    test('Sidebar toggling', async ({ page }) => {
      const sbPage = new SbPage(page, expect);

      await expect(sbPage.page.locator('.sidebar-container')).toBeVisible();

      // toggle with keyboard shortcut
      await sbPage.page.locator('html').press('Alt+s');
      await expect(sbPage.page.locator('.sidebar-container')).toBeHidden();
      await sbPage.page.locator('html').press('Alt+s');
      await expect(sbPage.page.locator('.sidebar-container')).toBeVisible();

      // toggle with menu item
      await sbPage.page.locator('[aria-label="Settings"]').click();
      await sbPage.page.locator('#list-item-S').click();
      await expect(sbPage.page.locator('.sidebar-container')).toBeHidden();

      // toggle with "show sidebar" button
      await sbPage.page.locator('[aria-label="Show sidebar"]').click();
      await expect(sbPage.page.locator('.sidebar-container')).toBeVisible();
    });

    test('Story context menu actions', async ({ page }) => {
      test.skip(type !== 'dev', 'These actions are only applicable in dev mode');
      const sbPage = new SbPage(page, expect);
      await sbPage.navigateToStory('example/button', 'docs');

      // Context menu should contain open in editor for component node
      await page.locator('[data-item-id="example-button"]').hover();
      await page
        .locator('[data-item-id="example-button"]')
        .getByRole('button', { name: 'Open context menu' })
        .click();
      const sidebarContextMenu = page.getByRole('dialog');
      await expect(
        sidebarContextMenu.getByRole('button', { name: /open in editor/i })
      ).toBeVisible();
      await page.click('body');

      // Context menu should contain open in editor for docs node
      await page.locator('[data-item-id="example-button--docs"]').hover();
      await page
        .locator('[data-item-id="example-button--docs"]')
        .getByRole('button', { name: 'Open context menu' })
        .click();
      await expect(
        page.getByRole('dialog').getByRole('button', { name: /open in editor/i })
      ).toBeVisible();
      await page.click('body');

      // Context menu should contain open in editor and copy story name for story node
      await page.locator('[data-item-id="example-button--primary"]').hover();
      await page
        .locator('[data-item-id="example-button--primary"]')
        .getByRole('button', { name: 'Open context menu' })
        .click();
      await expect(
        page.getByRole('dialog').getByRole('button', { name: /open in editor/i })
      ).toBeVisible();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /copy story name/i })
        .click();

      await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain(
        'Primary'
      );
    });

    test('Story share actions (dev)', async ({ page }) => {
      test.skip(type !== 'dev', 'These actions are only applicable in dev mode');
      const sbPage = new SbPage(page, expect);
      await sbPage.navigateToStory('example/button', 'primary');
      await expect(page.getByRole('button', { name: 'Open in editor' })).toBeVisible();
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await expect(page.getByRole('button', { name: /Copy link/i })).toBeVisible();
      await page.getByRole('button', { name: /Copy link/i }).click();

      await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain(
        `${storybookUrl}/?path=/story/example-button--primary`
      );
    });

    test('Story share actions (build)', async ({ page }) => {
      test.skip(type !== 'build', 'These actions are only applicable in build mode');
      const sbPage = new SbPage(page, expect);
      await sbPage.navigateToStory('example/button', 'primary');
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await expect(page.getByRole('button', { name: /Copy link/i })).toBeVisible();
      await page.getByRole('button', { name: /Copy link/i }).click();

      await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain(
        `${storybookUrl}/?path=/story/example-button--primary`
      );
    });

    test('Toolbar toggling', async ({ page }) => {
      const sbPage = new SbPage(page, expect);
      const expectToolbarToBeVisible = async () => {
        const toolbar = page.getByTestId('sb-preview-toolbar').getByRole('toolbar');
        await expect(toolbar).toBeVisible();
      };

      const expectToolbarToNotExist = async () => {
        const toolbar = page.getByTestId('sb-preview-toolbar').getByRole('toolbar');
        await expect(toolbar).toBeHidden();
      };

      await expectToolbarToBeVisible();

      // toggle with keyboard shortcut
      await sbPage.page.locator('html').press('Alt+t');
      await expectToolbarToNotExist();
      await sbPage.page.locator('html').press('Alt+t');
      await expectToolbarToBeVisible();

      // toggle with menu item
      await sbPage.page.locator('[aria-label="Settings"]').click();
      await sbPage.page.locator('#list-item-T').click();
      await expectToolbarToNotExist();
      await sbPage.page.locator('#list-item-T').click();
      await expectToolbarToBeVisible();
    });

    test.describe('Panel', () => {
      test('Hidden in docs view', async ({ page }) => {
        const sbPage = new SbPage(page, expect);

        // navigate to docs to hide panel
        await sbPage.navigateToStory('example/button', 'docs');

        await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();

        // toggle with keyboard shortcut
        await sbPage.page.locator('html').press('Alt+a');
        await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();
        await sbPage.page.locator('html').press('Alt+a');
        await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();
      });

      test('Toggling', async ({ page }) => {
        const sbPage = new SbPage(page, expect);

        // navigate to story to show panel
        await sbPage.navigateToStory('example/button', 'primary');

        await expect(sbPage.page.locator('#storybook-panel-root')).toBeVisible();

        // toggle with keyboard shortcut
        await sbPage.page.locator('html').press('Alt+a');
        await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();
        await sbPage.page.locator('html').press('Alt+a');
        await expect(sbPage.page.locator('#storybook-panel-root')).toBeVisible();

        // toggle with menu item
        await sbPage.page.locator('[aria-label="Settings"]').click();
        await sbPage.page.locator('#list-item-A').click();
        await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();
        await sbPage.page.locator('html').press('Escape');

        // toggle with "Show addon panel" button
        await sbPage.page.locator('[aria-label="Show addon panel"]').click();
        await expect(sbPage.page.locator('#storybook-panel-root')).toBeVisible();
      });

      test('Positioning', async ({ page }) => {
        const sbPage = new SbPage(page, expect);

        // navigate to story to show panel
        await sbPage.navigateToStory('example/button', 'primary');

        await expect(sbPage.page.locator('#storybook-panel-root')).toBeVisible();

        // toggle position with keyboard shortcut
        await sbPage.page.locator('html').press('Alt+d');
        await expect(sbPage.page.locator('#storybook-panel-root')).toBeVisible();
        // TODO: how to assert panel position?

        // hide with keyboard shortcut
        await sbPage.page.locator('html').press('Alt+a');
        await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();

        // toggling position should also show the panel again
        await sbPage.page.locator('html').press('Alt+d');
        await expect(sbPage.page.locator('#storybook-panel-root')).toBeVisible();
      });
    });

    test('Fullscreen toggling', async ({ page }) => {
      const sbPage = new SbPage(page, expect);

      // navigate to story to show panel
      await sbPage.navigateToStory('example/button', 'primary');

      await expect(sbPage.page.locator('#storybook-panel-root')).toBeVisible();
      await expect(sbPage.page.locator('.sidebar-container')).toBeVisible();

      // toggle with keyboard shortcut
      await sbPage.page.locator('html').press('Alt+f');
      await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();
      await expect(sbPage.page.locator('.sidebar-container')).toBeHidden();

      await sbPage.page.locator('html').press('Alt+f');
      await expect(sbPage.page.locator('#storybook-panel-root')).toBeVisible();
      await expect(sbPage.page.locator('.sidebar-container')).toBeVisible();

      // toggle with "go/exit fullscreen" button
      await sbPage.page.locator('[aria-label="Enter full screen"]').click();
      await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();
      await expect(sbPage.page.locator('.sidebar-container')).toBeHidden();

      await sbPage.page.locator('[aria-label="Exit full screen"]').click();
      await expect(sbPage.page.locator('#storybook-panel-root')).toBeVisible();
      await expect(sbPage.page.locator('.sidebar-container')).toBeVisible();

      // go fullscreen when sidebar is shown but panel is hidden
      await sbPage.page.locator('[aria-label="Enter full screen"]').click();
      await sbPage.page.locator('[aria-label="Show sidebar"]').click();
      await expect(sbPage.page.locator('.sidebar-container')).toBeVisible();
      await sbPage.page.locator('[aria-label="Enter full screen"]').click();
      await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();
      await expect(sbPage.page.locator('.sidebar-container')).toBeHidden();

      // go fullscreen when panel is shown but sidebar is hidden
      await sbPage.page.locator('[aria-label="Show addon panel"]').click();
      await expect(sbPage.page.locator('#storybook-panel-root')).toBeVisible();
      await sbPage.page.locator('[aria-label="Enter full screen"]').click();
      await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();
      await expect(sbPage.page.locator('.sidebar-container')).toBeHidden();
    });

    test('Settings page', async ({ page }) => {
      const sbPage = new SbPage(page, expect);
      await sbPage.page.locator('[aria-label="Settings"]').click();
      await sbPage.page.locator('#list-item-about').click();

      expect(sbPage.page.url()).toContain('/settings/about');

      await expect(sbPage.page.locator('#storybook-panel-root')).toBeHidden();

      await sbPage.page.locator('[aria-label="Close settings page"]').click();
      expect(sbPage.page.url()).not.toContain('/settings/about');
    });
  });

  test.describe('Mobile', () => {
    test.describe.configure({ retries: 3 });
    // TODO: remove this when SSV6 templates have been removed
    // Some assertions in these tests are not compatible with SSV6
    // GIven that SSV6 will be removed before the new mobile UI released, it doesn't make sense to fix them
    test.skip(templateName?.includes('ssv6') || false, 'Skip mobile UI tests for SSV6');

    // standard iPhone viewport size
    test.use({ viewport: { width: 390, height: 844 } });

    test('Navigate to story', async ({ page }) => {
      const sbPage = new SbPage(page, expect);

      const closeNavigationButton = sbPage.page.locator('[aria-label="Close navigation menu"]');
      const mobileNavigationHeading = sbPage.page.locator('[aria-label="Open navigation menu"]');

      // navigation menu is closed
      await expect(closeNavigationButton).toBeHidden();
      await expect(sbPage.page.locator('#storybook-explorer-menu')).toBeHidden();

      // open navigation menu
      await mobileNavigationHeading.click();

      await sbPage.openComponent('Example/Button');

      // navigation menu is still open
      await expect(sbPage.page.locator('#storybook-explorer-menu')).toBeVisible();
      // story has not changed
      expect(sbPage.page.url()).toContain('configure-your-project');

      await sbPage.navigateToStory('Example/Button', 'Secondary');

      // navigation menu is closed
      await expect(mobileNavigationHeading).toHaveText('Example/Button/Secondary');
      await expect(sbPage.page.locator('#storybook-explorer-menu')).toBeHidden();
      // story has changed
      expect(sbPage.page.url()).toContain('example-button--secondary');
    });

    test('Open and close addon panel', async ({ page }) => {
      const sbPage = new SbPage(page, expect);

      const mobileNavigationHeading = sbPage.page.locator('[aria-label="Open navigation menu"]');
      await mobileNavigationHeading.click();
      await sbPage.navigateToStory('Example/Button', 'Secondary');

      // panel is closed
      await expect(mobileNavigationHeading).toHaveText('Example/Button/Secondary');
      await expect(sbPage.page.getByRole('tab', { name: 'Controls' })).toBeHidden();

      // open panel
      await sbPage.page.locator('[aria-label="Open addon panel"]').click();

      // panel is open
      await expect(sbPage.page.getByRole('tab', { name: 'Controls' })).toBeVisible();

      // close panel
      await sbPage.page.getByRole('button', { name: 'Close addon panel' }).click();

      // panel is closed
      await expect(mobileNavigationHeading).toHaveText('Example/Button/Secondary');
      await expect(sbPage.page.getByRole('tab', { name: 'Controls' })).toBeHidden();
    });
  });
});
