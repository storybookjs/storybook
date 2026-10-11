import { describe, test } from 'vitest';
import {
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectReviewOpenedInBrowser,
  expectSkillInvoked,
  getEvalContext,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  modelRunsTestsOnlyWhenAsked,
} from '#test-utils';

describe('writing stories for an existing AlertBanner', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      requireAgentRun: !modelRunsTestsOnlyWhenAsked(),
      covering: ['alertbanner'],
    });
  });

  test('uses Storybook story instructions and publishes a display review', () => {
    expectWorkflowCalls(['get-storybook-story-instructions', 'review-create']);
    expectDisplayReviewForVisualChange();
  });

  test('opens the review in the in-app browser', () => {
    expectReviewOpenedInBrowser();
  });

  test('the review covers the new AlertBanner stories', () => {
    expectStoryIdsInDisplayReview(['alertbanner']);
  });

  test('discovers stories through the workflow tools before publishing the review', () => {
    expectStoryDiscoveryBeforeReview();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    test.skipIf(integration === 'mcp')('invokes the stories skill', () => {
      expectSkillInvoked('stories');
    });

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => {
        expectDevServerLeftRunning();
      }
    );
  });
});
