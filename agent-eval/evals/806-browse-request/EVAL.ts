import { test } from 'vitest';
import {
  expectDisplayReviewForBrowseRequest,
  expectPreviewBrowserStarted,
  expectPreviewStoriesWithFinalLinks,
  expectStoryIdsInDisplayReview,
  expectValidStorybookLaunchConfig,
  isReviewEnabled,
} from '#test-utils';

const review = isReviewEnabled();

test.runIf(review)('publishes a display review for a browse request without changed files', () => {
  expectDisplayReviewForBrowseRequest();
});

// The prompt asks for ALL ReviewCard states; the fixture is untouched by a
// browse request, so the three story ids are stable and must all be shown.
test.runIf(review)('the review shows every existing ReviewCard story', () => {
  expectStoryIdsInDisplayReview([
    'reviewcard--default',
    'reviewcard--with-long-comment',
    'reviewcard--low-rating',
  ]);
});

test.runIf(!review)('previews the existing ReviewCard stories for a browse request', () => {
  expectPreviewStoriesWithFinalLinks({ covering: ['reviewcard'] });
});

test('keeps the pre-existing Storybook launch config valid', () => {
  expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
  expectPreviewBrowserStarted();
});
