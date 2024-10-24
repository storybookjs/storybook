import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const type = process.env.STORYBOOK_TYPE || 'dev';

test.describe('save-from-controls', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(type === 'build', `Skipping save-from-controls tests for production Storybooks`);

  test('Should be able to update a story', async ({ page, browserName }) => {
    // this is needed because the e2e test will generate a new file in the system
    // which we don't know of its location (it runs in different sandboxes)
    // so we just create a random id to make it easier to run tests
    const id = Math.random().toString(36).substring(7);

    test.skip(browserName !== 'chromium', `Skipping save-from-controls tests for ${browserName}`);

    await page.goto(storybookUrl);
    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();

    await sbPage.navigateToStory('example/button', 'primary');
    await sbPage.viewAddonPanel('Controls');

    // Update an arg
    const label = sbPage.panelContent().locator('textarea[name=label]');
    const value = await label.inputValue();
    await label.fill(value + ' Updated ' + id);
    await label.blur();

    // Assert the footer is shown
    await sbPage.panelContent().locator('[data-short-label="Unsaved changes"]').isVisible();

    // update the story
    await sbPage.panelContent().locator('button').getByText('Update story').click();

    // Assert the file is saved
    const notification1 = sbPage.page.getByTitle('Story saved');
    await expect(notification1).toBeVisible();

    // dismiss
    await notification1.click();
    await notification1.isHidden();

    // Update an arg
    await label.fill(value + ' Copied');
    await label.blur();

    // Assert the footer is shown
    await sbPage.panelContent().locator('[data-short-label="Unsaved changes"]').isVisible();

    const buttons = sbPage
      .panelContent()
      .locator('[aria-label="Create new story with these settings"]');

    // clone the story
    await buttons.click();

    await sbPage.page.getByPlaceholder('Story export name').fill('ClonedStory' + id);
    await sbPage.page.getByRole('button', { name: 'Create' }).click();

    // Assert the file is saved
    const notification2 = sbPage.page.getByTitle('Story created');
    await expect(notification2).toBeVisible();
    await notification2.click();

    // Assert the Button components is rendered in the preview
    await expect(sbPage.previewRoot()).toContainText('Button');
  });
});
