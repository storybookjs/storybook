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

// With the `experimentalReview` flag on (the ci:review label), visual work
// must end in a published display-review; with it off (the default),
// display-review is not registered and the workflow ends in preview links.
const review = isReviewEnabled();

// A ProfileCard (avatar/initials, tags, action buttons) is built from
// Reshaped primitives (Avatar, Badge, Button, …), and their props must come
// from the documentation tools — never guessed or read out of
// node_modules/reshaped/dist. Asserted on the Claude experiments in both
// review modes, like 801; codex is an accepted known failure there (skipped
// the docs tools under both instruction shapes, storybookjs/mcp#315).
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

// Same clean-project create scenario as 801, so the §6a.2 completeness rule
// applies identically: every story the agent created must appear in the review.
test.runIf(review)('every new story appears in the display review', () => {
	expectAllStoryExportsInDisplayReview();
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
	expectStoryTestsRanAndPassed({ covering: ['profilecard'] });
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
