import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

test.describe('addon-interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page).waitUntilLoaded();
  });

  test('should have interactions', async ({ page }) => {
    // templateName is e.g. 'vue-cli/default-js'
    test.skip(
      /^(lit)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support addon-interactions`
    );

    const sbPage = new SbPage(page);

    await sbPage.navigateToStory('example/page', 'logged-in');
    await sbPage.viewAddonPanel('Interactions');

    const welcome = await sbPage.previewRoot().locator('.welcome');
    await expect(welcome).toContainText('Welcome, Jane Doe!', { timeout: 50000 });

    const interactionsTab = await page.locator('#tabbutton-storybook-interactions-panel');
    await expect(interactionsTab).toContainText(/(\d)/);
    await expect(interactionsTab).toBeVisible();

    const panel = sbPage.panelContent();
    await expect(panel).toContainText(/Pass/);
    await expect(panel).toContainText(/userEvent.click/);
    await expect(panel).toBeVisible();

    const done = await panel.locator('[data-testid=icon-done]').nth(0);
    await expect(done).toBeVisible();
  });

  test('should step through interactions', async ({ page, browserName }) => {
    // templateName is e.g. 'vue-cli/default-js'
    test.skip(
      /^(lit)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support addon-interactions`
    );
    test.skip(
      browserName === 'firefox',
      `Skipping on FIreFox, which has trouble with "initial value"`
    );

    const sbPage = new SbPage(page);

    await sbPage.deepLinkToStory(storybookUrl, 'addons/interactions/basics', 'type-and-clear');
    await sbPage.viewAddonPanel('Interactions');

    // Test initial state - Interactions have run, count is correct and values are as expected
    const formInput = await sbPage.previewRoot().locator('#interaction-test-form input');
    await expect(formInput).toHaveValue('final value', { timeout: 50000 });

    const interactionsTab = await page.locator('#tabbutton-storybook-interactions-panel');
    await expect(interactionsTab.getByText('3')).toBeVisible();
    await expect(interactionsTab).toBeVisible();
    await expect(interactionsTab).toBeVisible();

    const panel = sbPage.panelContent();
    const runStatusBadge = await panel.locator('[aria-label="Status of the test run"]');
    await expect(runStatusBadge).toContainText(/Pass/);
    await expect(panel).toContainText(/"initial value"/);
    await expect(panel).toContainText(/clear/);
    await expect(panel).toContainText(/"final value"/);
    await expect(panel).toBeVisible();

    // Test interactions debugger - Stepping through works, count is correct and values are as expected
    const interactionsRow = await panel.locator('[aria-label="Interaction step"]');

    await interactionsRow.first().isVisible();

    await expect(await interactionsRow.count()).toEqual(3);
    const firstInteraction = interactionsRow.first();
    await firstInteraction.click();

    await expect(runStatusBadge).toContainText(/Runs/);
    await expect(formInput).toHaveValue('initial value');

    const goForwardBtn = await panel.locator('[aria-label="Go forward"]');
    await goForwardBtn.click();
    await expect(formInput).toHaveValue('');
    await goForwardBtn.click();
    await expect(formInput).toHaveValue('final value');

    await expect(runStatusBadge).toContainText(/Pass/);

    // Test rerun state (from addon panel) - Interactions have rerun, count is correct and values are as expected
    const rerunInteractionButton = await panel.locator('[aria-label="Rerun"]');
    await rerunInteractionButton.click();

    await expect(formInput).toHaveValue('final value');

    await interactionsRow.first().isVisible();
    await interactionsRow.nth(1).isVisible();
    await interactionsRow.nth(2).isVisible();
    await expect(interactionsTab.getByText('3')).toBeVisible();
    await expect(interactionsTab).toBeVisible();
    await expect(interactionsTab.getByText('3')).toBeVisible();

    // Test remount state (from toolbar) - Interactions have rerun, count is correct and values are as expected
    const remountComponentButton = await page.locator('[title="Remount component"]');
    await remountComponentButton.click();

    await interactionsRow.first().isVisible();
    await interactionsRow.nth(1).isVisible();
    await interactionsRow.nth(2).isVisible();
    await expect(interactionsTab.getByText('3')).toBeVisible();
    await expect(interactionsTab).toBeVisible();
    await expect(interactionsTab).toBeVisible();
    await expect(formInput).toHaveValue('final value');
  });

  test('should show unhandled errors', async ({ page }) => {
    test.skip(
      /^(lit)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support addon-interactions`
    );
    // We trigger the implicit action error here, but angular works a bit different with implicit actions.
    test.skip(/^(angular)/i.test(`${templateName}`));

    const sbPage = new SbPage(page);

    await sbPage.deepLinkToStory(storybookUrl, 'addons/interactions/unhandled-errors', 'default');
    await sbPage.viewAddonPanel('Interactions');

    const button = await sbPage.previewRoot().locator('button');
    await expect(button).toContainText('Button', { timeout: 50000 });

    const panel = sbPage.panelContent();
    await expect(panel).toContainText(/Fail/);
    await expect(panel).toContainText(/Found 1 unhandled error/);
    await expect(panel).toBeVisible();
  });
});
