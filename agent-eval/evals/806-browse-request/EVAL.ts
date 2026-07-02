import { test } from 'vitest';
import {
	expectDisplayReviewForBrowseRequest,
	expectPreviewBrowserStarted,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
} from '#test-utils';

// Browse request (Agentic Review Eval instructions §7 branch 4): no code
// changes; the agent resolves the existing ReviewCard stories from the live
// index and publishes a review without changedFiles.

test('publishes a display review for a browse request without changedFiles', () => {
	expectWorkflowCalls(['display-review']);
	expectDisplayReviewForBrowseRequest();
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
