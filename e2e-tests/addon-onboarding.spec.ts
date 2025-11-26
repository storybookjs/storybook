import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage, hasOnboardingFeature } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';
const type = process.env.STORYBOOK_TYPE || 'dev';

test.describe('addon-onboarding', () => {
  test.skip(type === 'build', `Skipping addon tests for production Storybooks`);
  test.skip(
    !hasOnboardingFeature(templateName),
    `Skipping ${templateName}, which does not have addon-onboarding set up.`
  );
  test('the onboarding flow', async ({ page }) => {
    await page.goto(`${storybookUrl}/?path=/onboarding`);
    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();

    await expect(page.getByRole('heading', { name: 'Meet your new frontend' })).toBeVisible();
    await page.locator('#storybook-addon-onboarding').getByRole('button').click();

    await expect(page.getByText('Interactive story playground')).toBeVisible();
    await page.getByLabel('Next').click();

    await expect(page.getByText('Save your changes as a new')).toBeVisible();
    await page.getByLabel('Next').click();

    await expect(page.getByRole('heading', { name: 'Create new story' })).toBeVisible();
    await page.getByPlaceholder('Story export name').click();

    // this is needed because the e2e test will generate a new file in the system
    // which we don't know of its location (it runs in different sandboxes)
    // so we just create a random id to make it easier to run tests
    const id = Math.random().toString(36).substring(7);
    await page.getByPlaceholder('Story export name').fill('Test-' + id);
    await page.getByRole('button', { exact: true, name: 'Create' }).click();

    await expect(page.getByText('You just added your first')).toBeVisible();
    await page.getByLabel('Last').click();

    await page.getByRole('checkbox', { name: 'Application UI' }).check();
    await page.getByRole('checkbox', { name: 'Functional testing' }).check();
    await page.locator('#referrer').selectOption('Web Search');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(
      sbPage.previewIframe().getByRole('heading', { name: 'Configure your project' })
    ).toBeVisible();
  });
});
