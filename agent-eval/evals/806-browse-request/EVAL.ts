import { test } from 'vitest';
import {
	expectDisplayReviewForBrowseRequest,
	expectPreviewBrowserStarted,
	expectStoryIdsInDisplayReview,
	expectValidStorybookLaunchConfig,
} from '#test-utils';

// Browse request (Agentic Review Eval instructions §7 branch 4): no code
// changes; the agent resolves the existing ReviewCard stories from the live
// index and publishes a review without changed files.

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

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
