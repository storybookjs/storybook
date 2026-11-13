import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

// The addon panel pre-renders every panel and re-renders them all when a story is prepared. Panels
// rely on that: the Controls panel reads the current story through the API in its render function
// and shows nothing until a prepared story reaches it.
test.describe('addon panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('the panels follow the prepared story and the selected tab stays', async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await sbPage.deepLinkToStory(storybookUrl, 'core/argtype', 'string');
    await sbPage.viewAddonPanel('Controls');

    const panel = sbPage.panelContent();
    await expect(panel.locator('textarea[name=label]')).toBeVisible();
    await expect(panel.locator('[name=primary]')).toHaveCount(0);

    await sbPage.navigateToStory('example/button', 'primary');

    await expect(page.getByRole('tab', { name: 'Controls' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(panel.locator('textarea[name=label]')).toBeVisible();
    await expect(panel.locator('[name=primary]')).toBeVisible();
  });

  test('the interactions panel leaves the failed state of the previous story', async ({ page }) => {
    test.skip(
      /^(lit)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support interactions`
    );
    // The unhandled-errors story triggers the implicit action error, which Angular handles differently.
    test.skip(/^(angular)/i.test(`${templateName}`));

    const sbPage = new SbPage(page, expect);

    await sbPage.deepLinkToStory(storybookUrl, 'core/component-test-unhandled-errors', 'default');
    await sbPage.viewAddonPanel('Interactions');

    const panel = sbPage.panelContent();
    const runStatusBadge = panel.locator('[aria-label^="Story status:"]');
    await expect(runStatusBadge).toContainText(/Fail/, { timeout: 50000 });
    await expect(panel).toContainText(/Found 1 unhandled error/);

    await sbPage.navigateToStory('core/component-test-basics', 'step');

    await expect(runStatusBadge).toContainText(/Pass/, { timeout: 50000 });
    await expect(panel).toContainText(/Enter value/);
    await expect(panel).not.toContainText(/unhandled error/);
  });

  test('the state of a panel survives a switch to another tab', async ({ page }) => {
    test.skip(
      /^(lit)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support interactions`
    );

    const sbPage = new SbPage(page, expect);

    await sbPage.deepLinkToStory(storybookUrl, 'core/component-test-basics', 'step');
    await sbPage.viewAddonPanel('Interactions');

    const panel = sbPage.panelContent();
    const stepToggle = panel.getByRole('button', {
      name: /nested interaction steps for Enter value/,
    });
    const nestedCall = panel.getByRole('button', { name: /^Interaction row: type/ });
    await expect(stepToggle).toHaveAttribute('aria-expanded', 'true', { timeout: 50000 });
    await expect(nestedCall).toBeVisible();

    await stepToggle.click();
    await expect(stepToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nestedCall).toBeHidden();

    await sbPage.viewAddonPanel('Controls');
    await expect(page.getByRole('tab', { name: 'Controls' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await sbPage.viewAddonPanel('Interactions');

    await expect(stepToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nestedCall).toBeHidden();
  });

  test('the Actions badge counts the events and clears on the next story', async ({ page }) => {
    test.skip(
      templateName.includes('react-native-web'),
      'React Native uses onPress rather than onClick'
    );

    const sbPage = new SbPage(page, expect);

    await sbPage.deepLinkToStory(storybookUrl, 'core/parameters-actions', 'basic');
    await sbPage.viewAddonPanel('Actions');

    const button = sbPage.previewRoot().getByRole('button');
    await button.click();
    await button.click();
    await button.click();

    const actionsTab = page.getByRole('tab', { name: /^Actions/ });
    await expect(actionsTab).toContainText('3');
    await expect(sbPage.panelContent()).toContainText('clicked');

    await sbPage.navigateToStory('core/argtype', 'string');

    await expect(actionsTab).not.toContainText(/\d/);
  });

  test('a panel disabled by a story parameter leaves the tab strip and comes back', async ({
    page,
  }) => {
    test.skip(
      /^(lit)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support interactions`
    );

    const sbPage = new SbPage(page, expect);
    const interactionsTab = page.getByRole('tab', { name: 'Interactions' });

    await sbPage.deepLinkToStory(storybookUrl, 'core/component-play', 'story-one');
    await expect(interactionsTab).toBeVisible();

    await sbPage.navigateToStory('core/component-play', 'disabled-interactions');
    await expect(interactionsTab).toBeHidden();

    await sbPage.navigateToStory('core/component-play', 'story-one');
    await expect(interactionsTab).toBeVisible();
    await sbPage.viewAddonPanel('Interactions');
    await expect(sbPage.panelContent().locator('[aria-label^="Story status:"]')).toBeVisible();
  });

  test('the Code tab follows docs.codePanel and its snippet follows the story', async ({
    page,
  }) => {
    const sbPage = new SbPage(page, expect);
    const codeTab = page.getByRole('tab', { name: 'Code' });

    await sbPage.deepLinkToStory(storybookUrl, 'addons/docs/codePanel', 'custom-code');
    await expect(codeTab).toBeVisible();
    await sbPage.viewAddonPanel('Code');
    await expect(sbPage.panelContent()).toContainText('Custom code');

    await sbPage.navigateToStory('addons/docs/codePanel', 'without-panel');
    await expect(codeTab).toBeHidden();

    await sbPage.navigateToStory('addons/docs/codePanel', 'custom-code');
    await expect(codeTab).toBeVisible();
    await sbPage.viewAddonPanel('Code');
    await expect(sbPage.panelContent()).toContainText('Custom code');
  });
});
