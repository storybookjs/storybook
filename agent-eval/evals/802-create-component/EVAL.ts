import { test } from 'vitest';
import {
	expectAllStoryExportsInDisplayReview,
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectStoryDiscoveryBeforeReview,
	expectStoryTestsRanAndPassed,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
} from '#test-utils';

// Unlike 801, the template's valid .claude/launch.json is left intact, so the
// plugin must reuse the existing config instead of writing a fresh one.

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

// Same clean-project create scenario as 801, so the §6a.2 completeness rule
// applies identically: every story the agent created must appear in the review.
test('every new story appears in the display review', () => {
	expectAllStoryExportsInDisplayReview();
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
	expectStoryTestsRanAndPassed({ covering: ['profilecard'] });
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
