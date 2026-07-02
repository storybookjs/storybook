import { test } from 'vitest';
import {
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectStoryIdsInDisplayReview,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
} from '#test-utils';

// The fixture ships two local components — ReviewCard (already covered by
// stories) and AlertBanner (uncovered) — so the agent must add stories for the
// uncovered one in an already-populated project.
// Note: expectAllStoryExportsInDisplayReview assumes the project starts
// without story files, so it cannot be used here.

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test('the review covers the new AlertBanner stories', () => {
	expectStoryIdsInDisplayReview(['alertbanner']);
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
