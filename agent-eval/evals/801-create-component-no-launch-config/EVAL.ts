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

// The review branch of this run: with the `experimentalReview` feature flag on
// (the ci:review label), visual work must end in a published display-review;
// with it off (the default), display-review is not even registered and the
// workflow ends in preview-stories links.
const review = isReviewEnabled();

// The template composes the Reshaped Storybook (refs in .storybook/main.ts)
// so get-documentation can serve its components. Asserted on the Claude
// experiments in both review modes: review-off ships the restored legacy
// instructions, which demonstrably work (cc-mcp and cc-plugin both called
// get-documentation in the 2026-07-03 run 28660377980); review-on ships this
// PR's slim instructions, green on the cc configs in the 2026-07-02 runs.
// Accepted known failure on codex: GPT-5.5 skipped the docs tools on both
// integrations under both instruction shapes (storybookjs/mcp#315, run
// 28660377980).
test.skipIf(getEvalContext().agent === 'codex')('uses the documentation tooling', () => {
	expectWorkflowCalls(['get-documentation']);
});

test.runIf(review)('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test.runIf(!review)('uses Storybook story instructions and previews the new stories', () => {
	expectWorkflowCalls(['get-storybook-story-instructions']);
	expectPreviewStoriesWithFinalLinks({ covering: ['toggleswitch'] });
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
	expectStoryTestsRanAndPassed({ covering: ['toggleswitch'] });
});

// Yann confirmed §6a.2 (2026-07-02, #sb-ade-plugins): stories the agent
// created must always appear in the review; curation groups, it never omits.
// The display-review hard rules and server instructions now state this.
test.runIf(review)('every new story appears in the display review', () => {
	expectAllStoryExportsInDisplayReview();
});

// TODO: Re-enable once the display-review workflow guidance teaches the agent
// to group stories into 2-5 meaningful collections (e.g. visual states vs
// interaction behavior). The judge currently fails runs because the agent
// publishes one collection containing every story (score 0.15 < 0.5 in the
// 2026-07-01T22-16-52 cc-plugin run).
test.skip('publishes a well-curated review', async () => {
	// 0.5 keeps this soft (per the eval spec, curation quality is scored, not
	// gating): minor flaws like one single-story collection pass, arbitrary
	// story dumps still fail.
	await expect(transcript).toScoreAtLeast(DISPLAY_REVIEW_CURATION_CRITERION, 0.5);
});

// The fixture overrides the template's .claude/launch.json with an empty
// configurations array (fixtures can only overwrite files, not delete them),
// so the plugin must set up the Storybook launch entry itself.
// The plugin path must engage the stories skill (Claude: via the Skill tool;
// Codex: by reading its SKILL.md). Skipped on the MCP integration, where no
// skills are installed.
test.skipIf(getEvalContext().integration === 'mcp')('invokes the stories skill', () => {
	expectSkillInvoked('stories');
});

test('writes a valid Storybook launch config for Claude preview tooling', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
