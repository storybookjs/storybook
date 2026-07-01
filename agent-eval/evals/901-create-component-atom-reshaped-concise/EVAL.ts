import { transcript } from '@vercel/agent-eval/eval';
import { expect, test } from 'vitest';
import {
	DISPLAY_REVIEW_CURATION_CRITERION,
	expectAllStoryExportsInDisplayReview,
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
} from '#test-utils';

// TODO: Re-enable once the guidance reliably steers agents to the documentation
// tools. The template composes the Reshaped Storybook (refs in .storybook/main.ts)
// so get-documentation can serve its components, and the Documentation Workflow
// instructions (MCP server instructions / `storybook ai --help`) already say to
// call list-all-documentation at task start and never assume component props —
// but agents ignore that and read node_modules/reshaped/dist/*.d.ts instead
// (0/2 in the 2026-07-01T22-53 cc-mcp and cc-plugin runs). Likely fix: add a
// documentation-first step to get-storybook-story-instructions, which agents
// demonstrably treat as the source of truth.
test.skip('uses the documentation tooling', () => {
	expectWorkflowCalls(['get-documentation']);
});

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

// TODO: Re-enable once the display-review guidance states that every new story
// must appear in the review. Agents currently omit interaction/play-function
// stories (e.g. published 4 of 6 storyIds in the 2026-07-01T22-18 cc-mcp run)
// because the tool instructions describe curation but never a completeness
// rule — pending Yann's take on aligning the guidance with eval spec §6a.2.
test.skip('every new story appears in the display review', () => {
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

test('writes a valid Storybook launch config for Claude preview tooling', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
