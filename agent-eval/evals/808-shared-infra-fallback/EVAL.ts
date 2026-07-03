import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectPreviewStoriesWithFinalLinks,
	expectSkillInvoked,
	expectStoryDiscoveryBeforeReview,
	expectStoryIdsInDisplayReview,
	expectStoryTestsRanAndPassed,
	expectValidStorybookLaunchConfig,
	getEvalContext,
	getWorkflowCalls,
	getWorkflowToolResults,
	isReviewEnabled,
} from '#test-utils';

// Shared-infrastructure change (Agentic Review Eval instructions §7 branch 2):
// the edited token file has no stories of its own, so the review must surface
// the stories of its *consumers* (Badge and StatusPill).

// With the `experimentalReview` flag on (the ci:review label), the consumer
// stories must surface in a published display-review; with it off (the
// default), display-review is not registered and the workflow ends in
// preview links for the consumer stories.
const review = isReviewEnabled();

// Guard against a vacuous pass: skipping the fallback only counts if the token
// change was actually performed.
test('changes the accent color token', () => {
	const colors = readFileSync('src/theme/colors.ts', 'utf8');
	expect(colors, 'Expected the accent token to change to #7c3aed').toMatch(/#7c3aed/i);
	expect(colors, 'Expected the old accent value #2563eb to be gone').not.toMatch(/#2563eb/i);
});

test.runIf(review)('publishes a display review for the visual token change', () => {
	expectDisplayReviewForVisualChange();
});

test.runIf(review)('the review surfaces the consumer stories, not the token file', () => {
	expectStoryIdsInDisplayReview(['badge', 'statuspill']);
});

// The token file has no stories of its own, so the previews must cover a
// consumer. Any-of rather than both: the review-off instructions say to
// preview "selected" storyIds from the discovery results, so surfacing one
// consumer's stories is a legitimate selection.
test.runIf(!review)('previews the consumer stories for the visual token change', () => {
	expectPreviewStoriesWithFinalLinks({ coveringAnyOf: ['badge', 'statuspill'] });
});

test.runIf(review)(
	'discovers stories through the workflow tools before publishing the review',
	() => {
		expectStoryDiscoveryBeforeReview();
	},
);

// The get-stories-by-component fallback is required exactly when the diff
// alone is insufficient (spec §4 "when to switch"): the token file is not a
// component, so unless get-changed-stories already surfaced both consumers,
// the agent must resolve them via get-stories-by-component.
// Deliberately conditional, not unconditional: on the MCP path the module
// graph's related-stories detection can legitimately surface both consumers
// from the diff alone (observed in the 2026-07-02 cc-mcp QA run — one
// get-changed-stories call covering badge + statuspill, zero fallback calls),
// and punishing that correct behavior would fight the spec.
test.runIf(review)(
	'falls back to get-stories-by-component when the diff does not cover the consumers',
	() => {
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
	},
);

// Required workflow step (test-instructions.md Validation Workflow): run
// run-story-tests after the change and do not report completion while story
// tests are failing.
// Review-on runs, accepted known failure — MCP-path agents skip validation
// for shared-token edits: the Validation Workflow section is lost to the
// 2,048-char MCP server-instruction truncation that PR #320 addresses (0
// run-story-tests calls in the 2026-07-02 cc-mcp QA run, while the same
// fixture passes on cc-plugin and codex-plugin). Re-enable on the review-on
// MCP path once #320 lands.
// Review-off runs (the default) assert every integration: the restored
// legacy instructions fit under the truncation limit, so the Validation
// Workflow reaches MCP agents again.
test.skipIf(isReviewEnabled() && getEvalContext().integration === 'mcp')(
	'runs story tests after the change and finishes with them passing',
	() => {
		expectStoryTestsRanAndPassed({ covering: ['badge', 'statuspill'] });
	},
);

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
