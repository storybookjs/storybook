import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectStoryDiscoveryBeforeReview,
	expectStoryIdsInDisplayReview,
	expectStoryTestsRanAndPassed,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
} from '#test-utils';

// Monorepo-leaf project shape (Agentic Review Eval instructions §7, secondary
// axis): the runnable Storybook lives in the @acme/ui workspace package, not
// at the repo root, so the agent must work inside the leaf.
// Note: expectAllStoryExportsInDisplayReview assumes the project starts
// without story files, so it cannot be used here (Card ships with stories).

test('creates the component inside the leaf package', () => {
	expect(
		existsSync('packages/ui/src/components/Callout.tsx'),
		'Expected packages/ui/src/components/Callout.tsx to be created',
	).toBe(true);
});

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test('the review covers the new Callout stories', () => {
	expectStoryIdsInDisplayReview(['callout']);
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
	expectStoryTestsRanAndPassed();
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
