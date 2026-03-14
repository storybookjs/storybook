import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';

import { type Locator, type Page, expect, test } from '@playwright/test';
import { join } from 'pathe';
import process from 'process';

import { SbPage, hasOnboardingFeature } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';
const type = process.env.STORYBOOK_TYPE || 'dev';

const logOnboardingState = async ({
  label,
  page,
  survey,
  lastButton,
}: {
  label: string;
  page: Page;
  survey: Locator;
  lastButton: Locator;
}) => {
  const onboardingContainer = page.locator('#storybook-addon-onboarding');
  const createdStoryMessage = page.getByText('You just added your first');
  const lastLabelButton = page.getByLabel('Last');

  const safeVisible = async (locator: Locator) => {
    try {
      return await locator.isVisible();
    } catch {
      return false;
    }
  };

  const safeCount = async (locator: Locator) => {
    try {
      return await locator.count();
    } catch {
      return -1;
    }
  };

  const safeAttribute = async (locator: Locator, attribute: string) => {
    try {
      return await locator.getAttribute(attribute);
    } catch {
      return null;
    }
  };

  const snapshot = {
    label,
    url: page.url(),
    surveyCount: await safeCount(survey),
    surveyVisible: await safeVisible(survey),
    lastButtonCount: await safeCount(lastButton),
    lastButtonVisible: await safeVisible(lastButton),
    lastLabelCount: await safeCount(lastLabelButton),
    lastLabelVisible: await safeVisible(lastLabelButton),
    createdStoryVisible: await safeVisible(createdStoryMessage),
    selectedStoryId: await safeAttribute(
      page.locator('#storybook-explorer-tree [data-selected="true"]').first(),
      'data-item-id'
    ),
    onboardingText: await onboardingContainer.textContent().catch(() => null),
    visibleButtons: await page
      .locator('button')
      .evaluateAll((elements) =>
        elements.slice(0, 20).map((element) => ({
          text: element.textContent?.trim() ?? null,
          ariaLabel: element.getAttribute('aria-label'),
          disabled: element.hasAttribute('disabled'),
        }))
      )
      .catch(() => []),
  };

  console.log(`[onboarding-e2e] ${JSON.stringify(snapshot)}`);
};

test.describe('addon-onboarding', () => {
  test.skip(type === 'build', `Skipping addon tests for production Storybooks`);
  test.skip(
    !hasOnboardingFeature(templateName),
    `Skipping ${templateName}, which does not have addon-onboarding set up.`
  );
  test('the onboarding flow', async ({ page }) => {
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (process.env.CI) {
      await rm(join(homedir(), '.storybook', 'settings.json'), { force: true });
    }

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

    const survey = page.getByRole('dialog', { name: 'Storybook user survey' });
    const lastButton = page.getByRole('button', { exact: true, name: 'Last' });
    const surveyChecklistLabel = page.getByText('Complete the onboarding survey', { exact: true });
    const openSurveyButton = page.getByRole('button', { exact: true, name: 'Open' });
    const createdStoryMessage = page.getByText('You just added your first');

    await sbPage.retryTimes(
      async () => {
        await expect(page).toHaveURL(/path=\/story\//, { timeout: 15_000 });
        await logOnboardingState({ label: 'after-create-story', page, survey, lastButton });

        const hasCreatedStoryMessage = await createdStoryMessage.isVisible().catch(() => false);
        const hasLastButton = await lastButton.isVisible().catch(() => false);
        const hasSurveyChecklist = await surveyChecklistLabel.isVisible().catch(() => false);

        expect(hasCreatedStoryMessage || hasLastButton || hasSurveyChecklist).toBe(true);
      },
      { retries: 3, delay: 1_000 }
    );

    await sbPage.retryTimes(
      async () => {
        await logOnboardingState({ label: 'before-last-step', page, survey, lastButton });
        try {
          const hasLastButton = await lastButton.isVisible().catch(() => false);

          if (hasLastButton) {
            await lastButton.click();
            await logOnboardingState({ label: 'after-last-click', page, survey, lastButton });
          }

          const hasSurvey = await survey.isVisible().catch(() => false);
          if (!hasSurvey) {
            await surveyChecklistLabel.waitFor({ state: 'visible', timeout: 5_000 });
            await openSurveyButton.waitFor({ state: 'visible', timeout: 5_000 });
            await openSurveyButton.click();
            await logOnboardingState({
              label: 'after-open-survey-click',
              page,
              survey,
              lastButton,
            });
          }

          await expect(survey).toBeVisible({ timeout: 5_000 });
          await logOnboardingState({
            label: 'after-survey-visible',
            page,
            survey,
            lastButton,
          });
        } catch (error) {
          await logOnboardingState({ label: 'last-step-failed', page, survey, lastButton });
          throw error;
        }
      },
      { retries: 3, delay: 1_000 }
    );

    const applicationUi = survey.getByRole('checkbox', { name: 'Application UI' });

    // The modal shell mounts before its contents are fully open and ready for interaction.
    await expect(applicationUi).toBeVisible({ timeout: 15_000 });

    await applicationUi.check();
    await survey.getByRole('checkbox', { name: 'Functional testing' }).check();
    await survey.locator('#referrer').selectOption('Web Search');
    await survey.getByRole('button', { name: 'Submit' }).click();

    // After completing onboarding, verify we navigate to a story (first story in the index)
    await expect(sbPage.page).toHaveURL(/\/(story|docs)\//);
    // Verify the preview iframe has loaded content
    await sbPage.waitUntilLoaded();
  });
});
