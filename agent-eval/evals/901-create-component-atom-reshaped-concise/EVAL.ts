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
	// 0.5 keeps this soft (per the eval spec, curation quality is scored, not
	// gating): minor flaws like one single-story collection pass, arbitrary
	// story dumps still fail.
	await expect(transcript).toScoreAtLeast(DISPLAY_REVIEW_CURATION_CRITERION, 0.5);
});

test('writes a valid Storybook launch config for Claude preview tooling', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
