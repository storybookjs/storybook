import {
  expectDisplayReviewForBrowseRequest,
  expectPreviewBrowserStarted,
  expectPreviewStoriesWithFinalLinks,
  expectStoryIdsInDisplayReview,
  expectValidStorybookLaunchConfig,
  getEvalContext,
  isReviewEnabled,
} from '#test-utils';
import { describe, test } from 'vitest';

describe('browsing existing ReviewCard Storybook states', () => {
  const review = isReviewEnabled();

  describe.runIf(review)('when review is enabled', () => {
    test('publishes a display review for a browse request without changed files', () => {
      expectDisplayReviewForBrowseRequest();
    });

    // The prompt asks for ALL ReviewCard states; the fixture is untouched by a
    // browse request, so the three story ids are stable and must all be shown.
    test('the review shows every existing ReviewCard story', () => {
      expectStoryIdsInDisplayReview([
        'reviewcard--default',
        'reviewcard--with-long-comment',
        'reviewcard--low-rating',
      ]);
    });
  });

  describe.runIf(!review)('when review is disabled', () => {
    test('previews the existing ReviewCard stories for a browse request', () => {
      expectPreviewStoriesWithFinalLinks({ covering: ['reviewcard'] });
    });
  });

  describe('depending on the current agent and integration', () => {
    const { agent, integration } = getEvalContext();

    test.skipIf(agent !== 'claude-code' || integration !== 'plugin')(
      'keeps the pre-existing Storybook launch config valid',
      () => expectValidStorybookLaunchConfig()
    );

    test.skipIf(integration !== 'plugin')('opens the preview browser when using the plugin', () =>
      expectPreviewBrowserStarted()
    );
  });
});
