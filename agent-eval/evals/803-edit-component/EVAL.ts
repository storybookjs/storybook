import { test } from 'vitest';
import {
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectStoryDiscoveryBeforeReview,
	expectStoryIdsInDisplayReview,
	expectStoryTestsRanAndPassed,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
} from '#test-utils';

// The fixture ships ReviewCard with existing stories, so this exercises the
// edit path: the review must cover the changed component, not just new files.
// Note: expectAllStoryExportsInDisplayReview assumes the project starts
// without story files, so it cannot be used here.

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test('the review covers the edited ReviewCard component', () => {
	expectStoryIdsInDisplayReview(['reviewcard']);
});

// Required workflow step (dev instructions "Mapping any input to story IDs"):
// story IDs in the review must come from a discovery tool, not from guessing.
test('discovers stories through the workflow tools before publishing the review', () => {
	expectStoryDiscoveryBeforeReview();
});

// Required workflow step (test-instructions.md Validation Workflow): run
// run-story-tests after the change and do not report completion while story
// tests are failing.
test('runs story tests after the change and finishes with them passing', () => {
	expectStoryTestsRanAndPassed({ covering: ['reviewcard'] });
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
