import {
  expectAllStoryExportsInDisplayReview,
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectReviewOpenedInBrowser,
  expectSkillInvoked,
  expectStoryDiscoveryBeforeReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';
import { describe, test } from 'vitest';

describe('creating a ProfileCard component', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['profilecard'],
    });
  });

  test('uses Storybook story instructions and publishes a display review', () => {
    expectWorkflowCalls(['ui-workflow', 'review-create']);
    expectDisplayReviewForVisualChange();
  });

  test('opens the review in the in-app browser', () => {
    expectReviewOpenedInBrowser();
  });

  test('every new story appears in the display review', () => {
    expectAllStoryExportsInDisplayReview();
  });

  test('discovers stories through the workflow tools before publishing the review', () => {
    expectStoryDiscoveryBeforeReview();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    // Building the ProfileCard from Reshaped primitives requires the docs tools.
    test('uses the documentation tooling', () => expectWorkflowCalls(['docs-show']));

    test.skipIf(integration === 'mcp')('invokes the ui-workflow skill', () =>
      expectSkillInvoked('ui-workflow')
    );

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => expectDevServerLeftRunning()
    );
  });
});
