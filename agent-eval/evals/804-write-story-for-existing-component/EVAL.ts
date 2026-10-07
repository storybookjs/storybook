import { describe, test } from 'vitest';
import {
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectPreviewOpenedInBrowser,
  expectPreviewStoriesWithFinalLinks,
  expectReviewOpenedInBrowser,
  expectSkillInvoked,
  getEvalContext,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  isReviewEnabled,
  modelRunsTestsOnlyWhenAsked,
} from '#test-utils';

describe('writing stories for an existing AlertBanner', () => {
  const review = isReviewEnabled();

  test.skipIf(modelRunsTestsOnlyWhenAsked())(
    'runs story tests after the change and finishes with them passing',
    async () => {
      await expectStoryTestsRanAndPassed({ covering: ['alertbanner'] });
    }
  );

  describe.runIf(review)('when review is enabled', () => {
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
  });

  describe.runIf(!review)('when review is disabled', () => {
    test('uses Storybook story instructions and previews the new AlertBanner stories', () => {
      expectWorkflowCalls(['get-storybook-story-instructions']);
      expectPreviewStoriesWithFinalLinks({ covering: ['alertbanner'] });
    });

    test('opens a story preview in the in-app browser', () => {
      expectPreviewOpenedInBrowser();
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
