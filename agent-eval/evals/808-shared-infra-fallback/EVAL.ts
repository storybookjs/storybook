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

// The edited token file has no stories of its own, so the run must surface
// the stories of its *consumers* (Badge and StatusPill).
const review = isReviewEnabled();

// Known failure on the codex+mcp cell with review on: GPT-5.5 edits the
// token file and ends the turn with zero MCP calls roughly every other run
// (three local runs, 2026-07-03). Codex surfaces MCP server instructions
// only as the tool namespace description, so for an edit it judges trivial
// it never reads the storybook namespace and no instruction wording can
// reach it. Review-off and codex-plugin runs pass consistently and stay
// asserted. Re-enable when the review-on workflow reliably reaches Codex at
// turn start.
const codexMcpReviewGap =
	review && getEvalContext().agent === 'codex' && getEvalContext().integration === 'mcp';

// Guard against a vacuous pass: skipping the fallback only counts if the token
// change was actually performed.
test('changes the accent color token', () => {
	const colors = readFileSync('src/theme/colors.ts', 'utf8');
	expect(colors, 'Expected the accent token to change to #7c3aed').toMatch(/#7c3aed/i);
	expect(colors, 'Expected the old accent value #2563eb to be gone').not.toMatch(/#2563eb/i);
});

test.runIf(review && !codexMcpReviewGap)(
	'publishes a display review for the visual token change',
	() => {
		expectDisplayReviewForVisualChange();
	},
);

test.runIf(review && !codexMcpReviewGap)(
	'the review surfaces the consumer stories, not the token file',
	() => {
		expectStoryIdsInDisplayReview(['badge', 'statuspill']);
	},
);

// Any-of rather than both: the review-off instructions say to preview
// "selected" storyIds from the discovery results, so surfacing one
// consumer's stories is a legitimate selection.
test.runIf(!review)('previews the consumer stories for the visual token change', () => {
	expectPreviewStoriesWithFinalLinks({ coveringAnyOf: ['badge', 'statuspill'] });
});

test.runIf(review && !codexMcpReviewGap)(
	'discovers stories through the workflow tools before publishing the review',
	() => {
		expectStoryDiscoveryBeforeReview();
	},
);

// Deliberately conditional: the module graph's related-stories detection can
// legitimately surface both consumers from the diff alone, and that is
// correct behavior — the fallback is only required when it doesn't.
test.runIf(review && !codexMcpReviewGap)(
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

test.skipIf(codexMcpReviewGap)(
	'runs story tests after the change and finishes with them passing',
	() => {
		expectStoryTestsRanAndPassed({ covering: ['badge', 'statuspill'] });
	},
);

test.skipIf(getEvalContext().integration === 'mcp')('invokes the stories skill', () => {
	expectSkillInvoked('stories');
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
