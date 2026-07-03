import { test } from 'vitest';
import {
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectPreviewStoriesWithFinalLinks,
	expectSkillInvoked,
	getEvalContext,
	expectStoryDiscoveryBeforeReview,
	expectStoryIdsInDisplayReview,
	expectStoryTestsRanAndPassed,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
	isReviewEnabled,
} from '#test-utils';

// The fixture ships ReviewCard with existing stories, so this exercises the
// edit path: the review must cover the changed component, not just new files.
// Note: expectAllStoryExportsInDisplayReview assumes the project starts
// without story files, so it cannot be used here.

// With the `experimentalReview` flag on (the ci:review label), visual work
// must end in a published display-review; with it off (the default),
// display-review is not registered and the workflow ends in preview links.
const review = isReviewEnabled();

// The edit adds a Report button to a component built from Reshaped
// primitives, so the agent reaches for new Reshaped components (Button) whose
// props must come from the documentation tools — never guessed or read out of
// node_modules/reshaped/dist. Asserted in both review modes, like 801.
test('uses the documentation tooling', () => {
	expectWorkflowCalls(['get-documentation']);
});

test.runIf(review)('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test.runIf(review)('the review covers the edited ReviewCard component', () => {
	expectStoryIdsInDisplayReview(['reviewcard']);
});

test.runIf(!review)('uses Storybook story instructions and previews the edited component', () => {
	expectWorkflowCalls(['get-storybook-story-instructions']);
	expectPreviewStoriesWithFinalLinks({ covering: ['reviewcard'] });
});

// Required workflow step (dev instructions "Mapping any input to story IDs"):
// story IDs in the review must come from a discovery tool, not from guessing.
test.runIf(review)(
	'discovers stories through the workflow tools before publishing the review',
	() => {
		expectStoryDiscoveryBeforeReview();
	},
);

// Required workflow step (test-instructions.md Validation Workflow): run
// run-story-tests after the change and do not report completion while story
// tests are failing.
test('runs story tests after the change and finishes with them passing', () => {
	expectStoryTestsRanAndPassed({ covering: ['reviewcard'] });
});

// The plugin path must engage the stories skill (Claude: via the Skill tool;
// Codex: by reading its SKILL.md). Skipped on the MCP integration, where no
// skills are installed.
test.skipIf(getEvalContext().integration === 'mcp')('invokes the stories skill', () => {
	expectSkillInvoked('stories');
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
