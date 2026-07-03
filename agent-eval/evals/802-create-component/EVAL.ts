import { test } from 'vitest';
import {
	expectAllStoryExportsInDisplayReview,
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectPreviewStoriesWithFinalLinks,
	expectSkillInvoked,
	getEvalContext,
	expectStoryDiscoveryBeforeReview,
	expectStoryTestsRanAndPassed,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
	isReviewEnabled,
} from '#test-utils';

// Unlike 801, the template's valid .claude/launch.json is left intact, so the
// plugin must reuse the existing config instead of writing a fresh one.
const review = isReviewEnabled();

// Building the ProfileCard from Reshaped primitives requires the docs tools;
// codex is an accepted known failure here (skipped the docs tools under both
// instruction shapes, CI run 28660377980, 2026-07-03).
test.skipIf(getEvalContext().agent === 'codex')('uses the documentation tooling', () => {
	expectWorkflowCalls(['get-documentation']);
});

test.runIf(review)('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test.runIf(!review)('uses Storybook story instructions and previews the new stories', () => {
	expectWorkflowCalls(['get-storybook-story-instructions']);
	expectPreviewStoriesWithFinalLinks({ covering: ['profilecard'] });
});

test.runIf(review)('every new story appears in the display review', () => {
	expectAllStoryExportsInDisplayReview();
});

test.runIf(review)(
	'discovers stories through the workflow tools before publishing the review',
	() => {
		expectStoryDiscoveryBeforeReview();
	},
);

test('runs story tests after the change and finishes with them passing', () => {
	expectStoryTestsRanAndPassed({ covering: ['profilecard'] });
});

test.skipIf(getEvalContext().integration === 'mcp')('invokes the stories skill', () => {
	expectSkillInvoked('stories');
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
