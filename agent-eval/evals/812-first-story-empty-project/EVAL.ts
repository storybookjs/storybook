import { describe, test } from 'vitest';
import {
  expectAllStoryExportsInDisplayReview,
  expectDisplayReviewForVisualChange,
  expectPreviewBrowserStarted,
  expectPreviewStoriesWithFinalLinks,
  expectSkillInvoked,
  getEvalContext,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectValidStorybookLaunchConfig,
  expectWorkflowCalls,
  isReviewEnabled,
} from '#test-utils';

describe('writing the first Button stories in an empty Storybook', () => {
  const review = isReviewEnabled();

  test('runs story tests after the change and finishes with them passing', () => {
    expectStoryTestsRanAndPassed({ covering: ['button'] });
  });

  describe.runIf(review)('when review is enabled', () => {
    test('uses Storybook story instructions and publishes a display review', () => {
      expectWorkflowCalls(['get-storybook-story-instructions', 'review-create']);
      expectDisplayReviewForVisualChange();
    });

    test('the review covers the new Button stories', () => {
      expectStoryIdsInDisplayReview(['button']);
    });

    test('every new story appears in the display review', () => {
      expectAllStoryExportsInDisplayReview();
    });

    test('discovers stories through the workflow tools before publishing the review', () => {
      expectStoryDiscoveryBeforeReview();
    });
  });

  describe.runIf(!review)('when review is disabled', () => {
    test('uses Storybook story instructions and previews the new stories', () => {
      expectWorkflowCalls(['get-storybook-story-instructions']);
      expectPreviewStoriesWithFinalLinks({ covering: ['button'] });
    });
  });

  describe('depending on the current agent and integration', () => {
    const { agent, integration } = getEvalContext();

    test.skipIf(integration === 'mcp')('invokes the stories skill', () => {
      expectSkillInvoked('stories');
    });

    test.skipIf(agent !== 'claude-code' || integration !== 'plugin')(
      'keeps the pre-existing Storybook launch config valid',
      () => {
        expectValidStorybookLaunchConfig();
      }
    );

    test.skipIf(integration !== 'plugin')('opens the preview browser when using the plugin', () => {
      expectPreviewBrowserStarted();
    });
  });
});
