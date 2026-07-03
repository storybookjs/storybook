import { test } from 'vitest';
import {
	expectAllStoryExportsInDisplayReview,
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectSkillInvoked,
	getEvalContext,
	expectStoryDiscoveryBeforeReview,
	expectStoryIdsInDisplayReview,
	expectStoryTestsRanAndPassed,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
} from '#test-utils';

// First-story scenario on the minimal vite-app template: Storybook (next) is
// installed and running, but the project has zero stories, so nothing about
// existing story conventions can be inferred from neighbors.

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test('the review covers the new Button stories', () => {
	expectStoryIdsInDisplayReview(['button']);
});

// The project starts without story files, so the §6a.2 completeness rule
// applies: every story the agent created must appear in the review.
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
	expectStoryTestsRanAndPassed({ covering: ['button'] });
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
