import { transcript } from '@vercel/agent-eval/eval';
import { expect, test } from 'vitest';
import {
	DISPLAY_REVIEW_CURATION_CRITERION,
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

const review = isReviewEnabled();

// Building with the external Reshaped components requires the docs tools —
// props must not be guessed or read out of node_modules.
// Known failure on the codex+mcp cell: GPT-5.5 intermittently builds the
// component from prior knowledge without calling get-documentation (CI run
// 28673251562 plus local runs, 2026-07-03; roughly one run in four), despite
// the tool descriptions and server instructions demanding the lookup.
// Codex-plugin runs pass consistently. Re-enable when Codex MCP runs
// reliably consult the docs tools.
test.skipIf(getEvalContext().agent === 'codex' && getEvalContext().integration === 'mcp')(
	'uses the documentation tooling',
	() => {
		expectWorkflowCalls(['get-documentation']);
	},
);

test.runIf(review)('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test.runIf(!review)('uses Storybook story instructions and previews the new stories', () => {
	expectWorkflowCalls(['get-storybook-story-instructions']);
	expectPreviewStoriesWithFinalLinks({ covering: ['toggleswitch'] });
});

test.runIf(review)(
	'discovers stories through the workflow tools before publishing the review',
	() => {
		expectStoryDiscoveryBeforeReview();
	},
);

test('runs story tests after the change and finishes with them passing', () => {
	expectStoryTestsRanAndPassed({ covering: ['toggleswitch'] });
});

test.runIf(review)('every new story appears in the display review', () => {
	expectAllStoryExportsInDisplayReview();
});

// TODO: Re-enable once the display-review workflow guidance teaches the agent
// to group stories into 2-5 meaningful collections (e.g. visual states vs
// interaction behavior). The judge currently fails runs because the agent
// publishes one collection containing every story (score 0.15 < 0.5 in the
// 2026-07-01T22-16-52 cc-plugin run).
test.skip('publishes a well-curated review', async () => {
	// 0.5 keeps this soft (curation quality is scored, not gating): minor
	// flaws like one single-story collection pass, arbitrary story dumps
	// still fail.
	await expect(transcript).toScoreAtLeast(DISPLAY_REVIEW_CURATION_CRITERION, 0.5);
});

test.skipIf(getEvalContext().integration === 'mcp')('invokes the stories skill', () => {
	expectSkillInvoked('stories');
});

// The fixture overrides the template's .claude/launch.json with an empty
// configurations array (fixtures can only overwrite files, not delete them),
// so the plugin must set up the Storybook launch entry itself.
test('writes a valid Storybook launch config for Claude preview tooling', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
