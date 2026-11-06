import {
  expectDisplayReviewForBrowseRequest,
  expectDevServerLeftRunning,
  expectReviewOpenedInBrowser,
  expectStoryIdsInDisplayReview,
  getEvalContext,
} from '#test-utils';
import { describe, test } from 'vitest';

describe('browsing existing ReviewCard Storybook states', () => {
  test('publishes a display review for a browse request without changed files', () => {
    expectDisplayReviewForBrowseRequest();
  });

  test('opens the review in the in-app browser', () => {
    expectReviewOpenedInBrowser();
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

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => expectDevServerLeftRunning()
    );
  });
});
