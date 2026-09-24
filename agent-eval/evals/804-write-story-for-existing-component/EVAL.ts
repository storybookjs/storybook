import { describe, test } from 'vitest';
import {
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectPreviewStoriesWithFinalLinks,
  expectSkillInvoked,
  getEvalContext,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  isReviewEnabled,
} from '#test-utils';

describe('writing stories for an existing AlertBanner', () => {
  const review = isReviewEnabled();

  test('runs story tests after the change and finishes with them passing', () => {
    expectStoryTestsRanAndPassed({ covering: ['alertbanner'] });
  });

  describe.runIf(review)('when review is enabled', () => {
    test('uses Storybook story instructions and publishes a display review', () => {
      expectWorkflowCalls(['get-storybook-story-instructions', 'review-create']);
      expectDisplayReviewForVisualChange();
    });

    test('the review covers the new AlertBanner stories', () => {
      expectStoryIdsInDisplayReview(['alertbanner']);
    });

    test('discovers stories through the workflow tools before publishing the review', () => {
      expectStoryDiscoveryBeforeReview();
    });
  });

  describe.runIf(!review)('when review is disabled', () => {
    test('uses Storybook story instructions and previews the new AlertBanner stories', () => {
      expectWorkflowCalls(['get-storybook-story-instructions']);
      expectPreviewStoriesWithFinalLinks({ covering: ['alertbanner'] });
    });
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
