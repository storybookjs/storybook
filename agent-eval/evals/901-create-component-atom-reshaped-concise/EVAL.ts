import { transcript } from '@vercel/agent-eval/eval';
import { expect, test } from 'vitest';
import {
	DISPLAY_REVIEW_CURATION_CRITERION,
	expectAllStoryExportsInDisplayReview,
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
} from '#test-utils';

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test('every new story appears in the display review', () => {
	expectAllStoryExportsInDisplayReview();
});

test('publishes a well-curated review', async () => {
	await expect(transcript).toScoreAtLeast(DISPLAY_REVIEW_CURATION_CRITERION, 0.7);
});

test('writes a valid Storybook launch config for Claude preview tooling', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
