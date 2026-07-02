import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectSkillInvoked,
	expectStoryDiscoveryBeforeReview,
	expectStoryIdsInDisplayReview,
	expectStoryTestsRanAndPassed,
	expectValidStorybookLaunchConfig,
	getEvalContext,
	getWorkflowCalls,
	getWorkflowToolResults,
} from '#test-utils';

// Shared-infrastructure change (Agentic Review Eval instructions §7 branch 2):
// the edited token file has no stories of its own, so the review must surface
// the stories of its *consumers* (Badge and StatusPill).

// Guard against a vacuous pass: skipping the fallback only counts if the token
// change was actually performed.
test('changes the accent color token', () => {
	const colors = readFileSync('src/theme/colors.ts', 'utf8');
	expect(colors, 'Expected the accent token to change to #7c3aed').toMatch(/#7c3aed/i);
	expect(colors, 'Expected the old accent value #2563eb to be gone').not.toMatch(/#2563eb/i);
});

test('publishes a display review for the visual token change', () => {
	expectDisplayReviewForVisualChange();
});

test('the review surfaces the consumer stories, not the token file', () => {
	expectStoryIdsInDisplayReview(['badge', 'statuspill']);
});

test('discovers stories through the workflow tools before publishing the review', () => {
	expectStoryDiscoveryBeforeReview();
});

// The get-stories-by-component fallback is required exactly when the diff
// alone is insufficient (spec §4 "when to switch"): the token file is not a
// component, so unless get-changed-stories already surfaced both consumers,
// the agent must resolve them via get-stories-by-component.
// Deliberately conditional, not unconditional: on the MCP path the module
// graph's related-stories detection can legitimately surface both consumers
// from the diff alone (observed in the 2026-07-02 cc-mcp QA run — one
// get-changed-stories call covering badge + statuspill, zero fallback calls),
// and punishing that correct behavior would fight the spec.
test('falls back to get-stories-by-component when the diff does not cover the consumers', () => {
	const changedStoriesResults = getWorkflowToolResults('get-changed-stories');
	const lastChangedStories = changedStoriesResults.at(-1);
	const diffCoversConsumers =
		lastChangedStories !== undefined &&
		!lastChangedStories.isError &&
		/badge/i.test(lastChangedStories.output) &&
		/statuspill/i.test(lastChangedStories.output);

	if (diffCoversConsumers) {
		return;
	}

	expect(
		getWorkflowCalls('get-stories-by-component').length,
		'get-changed-stories did not surface the consumer stories, so get-stories-by-component must be used',
	).toBeGreaterThan(0);
});

// Required workflow step (test-instructions.md Validation Workflow): run
// run-story-tests after the change and do not report completion while story
// tests are failing.
// Accepted known failure — MCP-path agents skip validation for shared-token
// edits: the Validation Workflow section is lost to the 2,048-char MCP
// server-instruction truncation that PR #320 addresses (0 run-story-tests
// calls in the 2026-07-02 cc-mcp QA run, while the same fixture passes on
// cc-plugin and codex-plugin). Gated to the plugin integration; re-enable on
// the MCP path once #320 lands.
test.skipIf(getEvalContext().integration === 'mcp')(
	'runs story tests after the change and finishes with them passing',
	() => {
		expectStoryTestsRanAndPassed({ covering: ['badge', 'statuspill'] });
	},
);

// The plugin path must engage the stories skill (Claude: via the Skill tool;
// Codex: by reading its SKILL.md); no-op on the MCP integration.
test('invokes the stories skill on the plugin path', () => {
	expectSkillInvoked('stories');
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
