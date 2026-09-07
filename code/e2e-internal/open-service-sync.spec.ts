import { expect, test, type Page } from '@playwright/test';
import process from 'process';

import { PREVIEW_STORY_TIMEOUT, waitForPreviewReady } from './helpers.ts';

/**
 * E2E regression for the open-service sync demos (`code/core/src/shared/open-service/sync-test`).
 *
 * Validates local command execution, remote command execution, static JSON loading, unhandled remote
 * commands in static builds, manager/preview sync, dev-server reload bootstrap, and cross-tab relay.
 */

/** Internal Storybook UI (`code/.storybook`) — not a sandbox template. */
const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

const runsAgainstDevServer = !['build', 'static'].includes(process.env.STORYBOOK_TYPE || 'dev');
const STORY_READY_TIMEOUT = PREVIEW_STORY_TIMEOUT;
const STATIC_LOAD_TIMEOUT = 20_000;

async function openOpenServicePanel(page: Page) {
  const tab = page.getByRole('tab', { name: /^Open Service/ });
  await expect(tab).toBeVisible({ timeout: STORY_READY_TIMEOUT });
  await tab.click();
  await expect(page.locator('#storybook-panel-root').getByRole('tabpanel')).toBeVisible();
}

async function gotoOpenServiceStory(page: Page, storyPath: string) {
  await page.goto(`${storybookUrl}/?path=/story/${storyPath}`);
  await waitForPreviewReady(page);
  await openOpenServicePanel(page);
}

test.describe('open-service sync example', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  test('local command syncs the manager panel and story inputs', async ({ page }) => {
    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-local-command--local-command-sync'
    );

    const panelInput = page.getByRole('textbox', {
      name: 'Local command manager panel sync input',
    });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Local command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('local-command-raw-service-state-value');

    await expect(panelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await panelInput.fill('local command: from panel');
      await expect(storyInput).toHaveValue('local command: from panel');
      await expect(rawStoryValue).toHaveText(JSON.stringify('local command: from panel'));

      await storyInput.fill('local command: from story');
      await expect(panelInput).toHaveValue('local command: from story');
      await expect(rawStoryValue).toHaveText(JSON.stringify('local command: from story'));
    } finally {
      await panelInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('local command persists state across reloads in dev', async ({ page }) => {
    test.skip(!runsAgainstDevServer, 'Reload persistence requires the dev-server relay channel.');

    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-local-command--local-command-sync'
    );

    const panelInput = page.getByRole('textbox', {
      name: 'Local command manager panel sync input',
    });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Local command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('local-command-raw-service-state-value');

    await expect(panelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await storyInput.fill('local command: before reload');
      await expect(panelInput).toHaveValue('local command: before reload');

      await page.reload();
      await waitForPreviewReady(page);
      await openOpenServicePanel(page);

      await expect(panelInput).toHaveValue('local command: before reload');
      await expect(storyInput).toHaveValue('local command: before reload');
      await expect(rawStoryValue).toHaveText(JSON.stringify('local command: before reload'));
    } finally {
      await panelInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('local command syncs across multiple open tabs', async ({ page, context }) => {
    test.skip(!runsAgainstDevServer, 'Cross-tab sync requires the dev-server relay channel.');

    const otherPage = await context.newPage();

    // Outer try guarantees the second tab is closed even if setup (navigation/visibility) throws.
    try {
      await gotoOpenServiceStory(
        page,
        'core-shared-open-service-sync-test-local-command--local-command-sync'
      );
      await gotoOpenServiceStory(
        otherPage,
        'core-shared-open-service-sync-test-local-command--local-command-sync'
      );

      const firstPanelInput = page.getByRole('textbox', {
        name: 'Local command manager panel sync input',
      });
      const firstStoryInput = page
        .frameLocator('#storybook-preview-iframe')
        .getByRole('textbox', { name: 'Local command story sync input' });
      const firstRawStoryValue = page
        .frameLocator('#storybook-preview-iframe')
        .getByTestId('local-command-raw-service-state-value');
      const secondPanelInput = otherPage.getByRole('textbox', {
        name: 'Local command manager panel sync input',
      });
      const secondStoryInput = otherPage
        .frameLocator('#storybook-preview-iframe')
        .getByRole('textbox', { name: 'Local command story sync input' });
      const secondRawStoryValue = otherPage
        .frameLocator('#storybook-preview-iframe')
        .getByTestId('local-command-raw-service-state-value');

      await expect(firstPanelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(firstStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(secondPanelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(secondStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

      try {
        await firstPanelInput.fill('');
        await expect(firstStoryInput).toHaveValue('');
        await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
        await expect(secondStoryInput).toHaveValue('');
        await expect(secondRawStoryValue).toHaveText(JSON.stringify(''));

        await firstPanelInput.fill('local command: from first tab');
        await expect(secondStoryInput).toHaveValue('local command: from first tab');
        await expect(secondRawStoryValue).toHaveText(
          JSON.stringify('local command: from first tab')
        );
        await expect(secondPanelInput).toHaveValue('local command: from first tab');

        await secondStoryInput.fill('local command: from second tab');
        await expect(firstPanelInput).toHaveValue('local command: from second tab');
        await expect(firstStoryInput).toHaveValue('local command: from second tab');
        await expect(firstRawStoryValue).toHaveText(
          JSON.stringify('local command: from second tab')
        );
      } finally {
        await firstPanelInput.fill('');
        await expect(firstStoryInput).toHaveValue('');
        await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
      }
    } finally {
      await otherPage.close();
    }
  });

  test('remote command syncs the manager panel and story inputs', async ({ page }) => {
    test.skip(!runsAgainstDevServer, 'Remote commands require the dev-server command handler.');

    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-remote-command--remote-command-sync'
    );

    const panelInput = page.getByRole('textbox', {
      name: 'Remote command manager panel sync input',
    });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Remote command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('remote-command-raw-service-state-value');

    await expect(panelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await panelInput.fill('remote command: from panel');
      await expect(storyInput).toHaveValue('remote command: from panel');
      await expect(rawStoryValue).toHaveText(JSON.stringify('remote command: from panel'));

      await storyInput.fill('remote command: from story');
      await expect(panelInput).toHaveValue('remote command: from story');
      await expect(rawStoryValue).toHaveText(JSON.stringify('remote command: from story'));
    } finally {
      await panelInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('remote command persists state across reloads in dev', async ({ page }) => {
    test.skip(!runsAgainstDevServer, 'Reload persistence requires the dev-server relay channel.');

    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-remote-command--remote-command-sync'
    );

    const panelInput = page.getByRole('textbox', {
      name: 'Remote command manager panel sync input',
    });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Remote command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('remote-command-raw-service-state-value');

    await expect(panelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await storyInput.fill('remote command: before reload');
      await expect(panelInput).toHaveValue('remote command: before reload');

      await page.reload();
      await waitForPreviewReady(page);
      await openOpenServicePanel(page);

      await expect(panelInput).toHaveValue('remote command: before reload');
      await expect(storyInput).toHaveValue('remote command: before reload');
      await expect(rawStoryValue).toHaveText(JSON.stringify('remote command: before reload'));
    } finally {
      await panelInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('remote command syncs across multiple open tabs', async ({ page, context }) => {
    test.skip(!runsAgainstDevServer, 'Cross-tab sync requires the dev-server relay channel.');

    const otherPage = await context.newPage();

    // Outer try guarantees the second tab is closed even if setup (navigation/visibility) throws.
    try {
      await gotoOpenServiceStory(
        page,
        'core-shared-open-service-sync-test-remote-command--remote-command-sync'
      );
      await gotoOpenServiceStory(
        otherPage,
        'core-shared-open-service-sync-test-remote-command--remote-command-sync'
      );

      const firstPanelInput = page.getByRole('textbox', {
        name: 'Remote command manager panel sync input',
      });
      const firstStoryInput = page
        .frameLocator('#storybook-preview-iframe')
        .getByRole('textbox', { name: 'Remote command story sync input' });
      const firstRawStoryValue = page
        .frameLocator('#storybook-preview-iframe')
        .getByTestId('remote-command-raw-service-state-value');
      const secondPanelInput = otherPage.getByRole('textbox', {
        name: 'Remote command manager panel sync input',
      });
      const secondStoryInput = otherPage
        .frameLocator('#storybook-preview-iframe')
        .getByRole('textbox', { name: 'Remote command story sync input' });
      const secondRawStoryValue = otherPage
        .frameLocator('#storybook-preview-iframe')
        .getByTestId('remote-command-raw-service-state-value');

      await expect(firstPanelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(firstStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(secondPanelInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
      await expect(secondStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

      try {
        await firstPanelInput.fill('');
        await expect(firstStoryInput).toHaveValue('');
        await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
        await expect(secondStoryInput).toHaveValue('');
        await expect(secondRawStoryValue).toHaveText(JSON.stringify(''));

        await firstPanelInput.fill('remote command: from first tab');
        await expect(secondStoryInput).toHaveValue('remote command: from first tab');
        await expect(secondRawStoryValue).toHaveText(
          JSON.stringify('remote command: from first tab')
        );
        await expect(secondPanelInput).toHaveValue('remote command: from first tab');

        await secondStoryInput.fill('remote command: from second tab');
        await expect(firstPanelInput).toHaveValue('remote command: from second tab');
        await expect(firstStoryInput).toHaveValue('remote command: from second tab');
        await expect(firstRawStoryValue).toHaveText(
          JSON.stringify('remote command: from second tab')
        );
      } finally {
        await firstPanelInput.fill('');
        await expect(firstStoryInput).toHaveValue('');
        await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
      }
    } finally {
      await otherPage.close();
    }
  });

  test('static load resolves entries from the live server in dev', async ({ page }) => {
    test.skip(!runsAgainstDevServer, 'Live server commands are only available in dev mode.');

    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-static-load--static-load-sync'
    );

    const panelAlpha = page.getByTestId('static-load-manager-panel-entry-alpha-value');
    const panelBeta = page.getByTestId('static-load-manager-panel-entry-beta-value');
    const panelUnbacked = page.getByTestId('static-load-manager-panel-unbacked-status');
    const storyAlpha = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-entry-alpha-value');
    const storyBeta = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-entry-beta-value');
    const storyUnbacked = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-unbacked-status');

    await expect(panelAlpha).toHaveText(JSON.stringify('static-load:alpha'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(panelBeta).toHaveText(JSON.stringify('static-load:beta'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(panelUnbacked).toHaveText(JSON.stringify('static-load:unbacked'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyAlpha).toHaveText(JSON.stringify('static-load:alpha'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyBeta).toHaveText(JSON.stringify('static-load:beta'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyUnbacked).toHaveText(JSON.stringify('static-load:unbacked'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
  });

  test('static load reads prebuilt JSON and rejects unbacked commands in a static build', async ({
    page,
  }) => {
    test.skip(runsAgainstDevServer, 'Prebuilt JSON assertions require a static Storybook build.');

    await gotoOpenServiceStory(
      page,
      'core-shared-open-service-sync-test-static-load--static-load-sync'
    );

    const panelAlpha = page.getByTestId('static-load-manager-panel-entry-alpha-value');
    const panelBeta = page.getByTestId('static-load-manager-panel-entry-beta-value');
    const panelUnbacked = page.getByTestId('static-load-manager-panel-unbacked-status');
    const storyAlpha = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-entry-alpha-value');
    const storyBeta = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-entry-beta-value');
    const storyUnbacked = page
      .frameLocator('#storybook-preview-iframe')
      .getByTestId('static-load-story-unbacked-status');

    await expect(panelAlpha).toHaveText(JSON.stringify('static-load:alpha'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(panelBeta).toHaveText(JSON.stringify('static-load:beta'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyAlpha).toHaveText(JSON.stringify('static-load:alpha'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyBeta).toHaveText(JSON.stringify('static-load:beta'), {
      timeout: STATIC_LOAD_TIMEOUT,
    });

    await expect(panelUnbacked).toContainText('No runtime acknowledged remote command', {
      timeout: STATIC_LOAD_TIMEOUT,
    });
    await expect(storyUnbacked).toContainText('No runtime acknowledged remote command', {
      timeout: STATIC_LOAD_TIMEOUT,
    });
  });
});
