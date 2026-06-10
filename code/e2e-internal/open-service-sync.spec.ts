import { expect, test } from '@playwright/test';
import process from 'process';

import { PREVIEW_STORY_TIMEOUT, waitForPreviewReady } from './helpers.ts';

/**
 * E2E regression for the paired open-service sync demos
 * (`code/core/src/shared/open-service/sync-test`).
 *
 * Validates local command execution, remote command execution, manager/preview sync, dev-server
 * reload bootstrap, and cross-tab relay.
 */

/** Internal Storybook UI (`code/.storybook`) — not a sandbox template. */
const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';

const runsAgainstDevServer = !['build', 'static'].includes(process.env.STORYBOOK_TYPE || 'dev');
const STORY_READY_TIMEOUT = PREVIEW_STORY_TIMEOUT;

test.describe('open-service sync example', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  test('local command syncs the toolbar and story inputs', async ({ page }) => {
    await page.goto(
      `${storybookUrl}/?path=/story/core-shared-open-service-sync-test-local-command--local-command-sync`
    );

    const toolbarInput = page
      .getByRole('toolbar')
      .getByRole('textbox', { name: 'Local command toolbar sync input' });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Local command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByLabel('Local command raw service state value');

    await expect(toolbarInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await waitForPreviewReady(page);
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await toolbarInput.fill('local command: from toolbar');
      await expect(storyInput).toHaveValue('local command: from toolbar');
      await expect(rawStoryValue).toHaveText(JSON.stringify('local command: from toolbar'));

      await storyInput.fill('local command: from story');
      await expect(toolbarInput).toHaveValue('local command: from story');
      await expect(rawStoryValue).toHaveText(JSON.stringify('local command: from story'));
    } finally {
      await toolbarInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('local command persists state across reloads in dev', async ({ page }) => {
    test.skip(!runsAgainstDevServer, 'Reload persistence requires the dev-server relay channel.');

    await page.goto(
      `${storybookUrl}/?path=/story/core-shared-open-service-sync-test-local-command--local-command-sync`
    );

    const toolbarInput = page
      .getByRole('toolbar')
      .getByRole('textbox', { name: 'Local command toolbar sync input' });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Local command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByLabel('Local command raw service state value');

    await expect(toolbarInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await waitForPreviewReady(page);
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await storyInput.fill('local command: before reload');
      await expect(toolbarInput).toHaveValue('local command: before reload');

      await page.reload();

      await expect(toolbarInput).toHaveValue('local command: before reload');
      await expect(storyInput).toHaveValue('local command: before reload');
      await expect(rawStoryValue).toHaveText(JSON.stringify('local command: before reload'));
    } finally {
      await toolbarInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('local command syncs across multiple open tabs', async ({ page, context }) => {
    test.skip(!runsAgainstDevServer, 'Cross-tab sync requires the dev-server relay channel.');

    const otherPage = await context.newPage();

    await page.goto(
      `${storybookUrl}/?path=/story/core-shared-open-service-sync-test-local-command--local-command-sync`
    );
    await otherPage.goto(
      `${storybookUrl}/?path=/story/core-shared-open-service-sync-test-local-command--local-command-sync`
    );

    const firstToolbarInput = page
      .getByRole('toolbar')
      .getByRole('textbox', { name: 'Local command toolbar sync input' });
    const firstStoryInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Local command story sync input' });
    const firstRawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByLabel('Local command raw service state value');
    const secondToolbarInput = otherPage
      .getByRole('toolbar')
      .getByRole('textbox', { name: 'Local command toolbar sync input' });
    const secondStoryInput = otherPage
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Local command story sync input' });
    const secondRawStoryValue = otherPage
      .frameLocator('#storybook-preview-iframe')
      .getByLabel('Local command raw service state value');

    await expect(firstToolbarInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await waitForPreviewReady(page);
    await expect(secondToolbarInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await waitForPreviewReady(otherPage);
    await expect(firstStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(secondStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await firstToolbarInput.fill('');
      await expect(firstStoryInput).toHaveValue('');
      await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
      await expect(secondStoryInput).toHaveValue('');
      await expect(secondRawStoryValue).toHaveText(JSON.stringify(''));

      await firstToolbarInput.fill('local command: from first tab');
      await expect(secondStoryInput).toHaveValue('local command: from first tab');
      await expect(secondRawStoryValue).toHaveText(JSON.stringify('local command: from first tab'));
      await expect(secondToolbarInput).toHaveValue('local command: from first tab');

      await secondStoryInput.fill('local command: from second tab');
      await expect(firstToolbarInput).toHaveValue('local command: from second tab');
      await expect(firstStoryInput).toHaveValue('local command: from second tab');
      await expect(firstRawStoryValue).toHaveText(JSON.stringify('local command: from second tab'));
    } finally {
      await firstToolbarInput.fill('');
      await expect(firstStoryInput).toHaveValue('');
      await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
      await otherPage.close();
    }
  });

  test('remote command syncs the toolbar and story inputs', async ({ page }) => {
    await page.goto(
      `${storybookUrl}/?path=/story/core-shared-open-service-sync-test-remote-command--remote-command-sync`
    );

    const toolbarInput = page
      .getByRole('toolbar')
      .getByRole('textbox', { name: 'Remote command toolbar sync input' });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Remote command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByLabel('Remote command raw service state value');

    await expect(toolbarInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await waitForPreviewReady(page);
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await toolbarInput.fill('remote command: from toolbar');
      await expect(storyInput).toHaveValue('remote command: from toolbar');
      await expect(rawStoryValue).toHaveText(JSON.stringify('remote command: from toolbar'));

      await storyInput.fill('remote command: from story');
      await expect(toolbarInput).toHaveValue('remote command: from story');
      await expect(rawStoryValue).toHaveText(JSON.stringify('remote command: from story'));
    } finally {
      await toolbarInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('remote command persists state across reloads in dev', async ({ page }) => {
    test.skip(!runsAgainstDevServer, 'Reload persistence requires the dev-server relay channel.');

    await page.goto(
      `${storybookUrl}/?path=/story/core-shared-open-service-sync-test-remote-command--remote-command-sync`
    );

    const toolbarInput = page
      .getByRole('toolbar')
      .getByRole('textbox', { name: 'Remote command toolbar sync input' });
    const storyInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Remote command story sync input' });
    const rawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByLabel('Remote command raw service state value');

    await expect(toolbarInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await waitForPreviewReady(page);
    await expect(storyInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await storyInput.fill('remote command: before reload');
      await expect(toolbarInput).toHaveValue('remote command: before reload');

      await page.reload();

      await expect(toolbarInput).toHaveValue('remote command: before reload');
      await expect(storyInput).toHaveValue('remote command: before reload');
      await expect(rawStoryValue).toHaveText(JSON.stringify('remote command: before reload'));
    } finally {
      await toolbarInput.fill('');
      await expect(storyInput).toHaveValue('');
      await expect(rawStoryValue).toHaveText(JSON.stringify(''));
    }
  });

  test('remote command syncs across multiple open tabs', async ({ page, context }) => {
    test.skip(!runsAgainstDevServer, 'Cross-tab sync requires the dev-server relay channel.');

    const otherPage = await context.newPage();

    await page.goto(
      `${storybookUrl}/?path=/story/core-shared-open-service-sync-test-remote-command--remote-command-sync`
    );
    await otherPage.goto(
      `${storybookUrl}/?path=/story/core-shared-open-service-sync-test-remote-command--remote-command-sync`
    );

    const firstToolbarInput = page
      .getByRole('toolbar')
      .getByRole('textbox', { name: 'Remote command toolbar sync input' });
    const firstStoryInput = page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Remote command story sync input' });
    const firstRawStoryValue = page
      .frameLocator('#storybook-preview-iframe')
      .getByLabel('Remote command raw service state value');
    const secondToolbarInput = otherPage
      .getByRole('toolbar')
      .getByRole('textbox', { name: 'Remote command toolbar sync input' });
    const secondStoryInput = otherPage
      .frameLocator('#storybook-preview-iframe')
      .getByRole('textbox', { name: 'Remote command story sync input' });
    const secondRawStoryValue = otherPage
      .frameLocator('#storybook-preview-iframe')
      .getByLabel('Remote command raw service state value');

    await expect(firstToolbarInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await waitForPreviewReady(page);
    await expect(secondToolbarInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await waitForPreviewReady(otherPage);
    await expect(firstStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });
    await expect(secondStoryInput).toBeVisible({ timeout: STORY_READY_TIMEOUT });

    try {
      await firstToolbarInput.fill('');
      await expect(firstStoryInput).toHaveValue('');
      await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
      await expect(secondStoryInput).toHaveValue('');
      await expect(secondRawStoryValue).toHaveText(JSON.stringify(''));

      await firstToolbarInput.fill('remote command: from first tab');
      await expect(secondStoryInput).toHaveValue('remote command: from first tab');
      await expect(secondRawStoryValue).toHaveText(
        JSON.stringify('remote command: from first tab')
      );
      await expect(secondToolbarInput).toHaveValue('remote command: from first tab');

      await secondStoryInput.fill('remote command: from second tab');
      await expect(firstToolbarInput).toHaveValue('remote command: from second tab');
      await expect(firstStoryInput).toHaveValue('remote command: from second tab');
      await expect(firstRawStoryValue).toHaveText(
        JSON.stringify('remote command: from second tab')
      );
    } finally {
      await firstToolbarInput.fill('');
      await expect(firstStoryInput).toHaveValue('');
      await expect(firstRawStoryValue).toHaveText(JSON.stringify(''));
      await otherPage.close();
    }
  });
});
