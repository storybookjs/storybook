import { test } from 'vitest';
import {
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectStoryIdsInDisplayReview,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
} from '#test-utils';

// The fixture ships ReviewCard with existing stories, so this exercises the
// edit path: the review must cover the changed component, not just new files.
// Note: expectAllStoryExportsInDisplayReview assumes the project starts
// without story files, so it cannot be used here.

// The edit adds a Report button to a component built from Reshaped
// primitives, so the agent reaches for new Reshaped components (Button) whose
// props must come from the documentation tools — never guessed or read out of
// node_modules/reshaped/dist. Enabled with storybookjs/mcp#320, like 801.
test('uses the documentation tooling', () => {
	expectWorkflowCalls(['get-documentation']);
});

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test('the review covers the edited ReviewCard component', () => {
	expectStoryIdsInDisplayReview(['reviewcard']);
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
