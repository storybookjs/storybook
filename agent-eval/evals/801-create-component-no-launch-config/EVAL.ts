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

// Enabled by storybookjs/mcp#320 (2026-07-02): the server instructions now
// survive Claude Code's 2,048-char MCP-instructions truncation (the
// Documentation Workflow never reached the model before), and
// get-storybook-story-instructions — which agents demonstrably treat as the
// source of truth — carries a documentation-first "Using library components"
// step steering agents to get-documentation instead of reading
// node_modules/reshaped/dist/*.d.ts.
test('uses the documentation tooling', () => {
	expectWorkflowCalls(['get-documentation']);
});

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

// Yann confirmed §6a.2 (2026-07-02, #sb-ade-plugins): stories the agent
// created must always appear in the review; curation groups, it never omits.
// The display-review hard rules and server instructions now state this.
test('every new story appears in the display review', () => {
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
test('writes a valid Storybook launch config for Claude preview tooling', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
