import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectStoryDiscoveryBeforeReview,
	expectStoryIdsInDisplayReview,
	expectStoryTestsRanAndPassed,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
	getEvalContext,
} from '#test-utils';

// Accepted known failure — in the monorepo leaf, the Claude plugin sometimes
// sources its instructions from `storybook ai setup` and verifies with a raw
// `npx vitest --project storybook` run instead of the canonical
// get-storybook-story-instructions / run-story-tests calls (1 of 2 runs in
// the 2026-07-02 cc-plugin QA batch; cc-mcp and codex-plugin pass). The
// review flow itself (discovery → display-review) stays strict everywhere.
// Re-enable for the Claude plugin once the stories-skill rewrite (#297)
// steers the leaf-package flow to the canonical tools.
const { agent, integration } = getEvalContext();
const CLAUDE_PLUGIN = agent === 'claude-code' && integration === 'plugin';

// Monorepo-leaf project shape (Agentic Review Eval instructions §7, secondary
// axis): the runnable Storybook lives in the @acme/ui workspace package, not
// at the repo root, so the agent must work inside the leaf.
// Note: expectAllStoryExportsInDisplayReview assumes the project starts
// without story files, so it cannot be used here (Card ships with stories).

test('creates the component inside the leaf package', () => {
	expect(
		existsSync('packages/ui/src/components/Callout.tsx'),
		'Expected packages/ui/src/components/Callout.tsx to be created',
	).toBe(true);
});

test('publishes a display review for the new component', () => {
	expectWorkflowCalls(['display-review']);
	expectDisplayReviewForVisualChange();
});

// See the accepted-known-failure note above the CLAUDE_PLUGIN constant.
test.skipIf(CLAUDE_PLUGIN)('uses the Storybook story instructions', () => {
	expectWorkflowCalls(['get-storybook-story-instructions']);
});

test('the review covers the new Callout stories', () => {
	expectStoryIdsInDisplayReview(['callout']);
});

// Required workflow step (dev instructions "Mapping any input to story IDs"):
// story IDs in the review must come from a discovery tool, not from guessing.
test('discovers stories through the workflow tools before publishing the review', () => {
	expectStoryDiscoveryBeforeReview();
});

// Required workflow step (test-instructions.md Validation Workflow): run
// run-story-tests after the change and do not report completion while story
// tests are failing. Skipped on the Claude plugin — see the
// accepted-known-failure note above the CLAUDE_PLUGIN constant.
test.skipIf(CLAUDE_PLUGIN)(
	'runs story tests after the change and finishes with them passing',
	() => {
		expectStoryTestsRanAndPassed({ covering: ['callout'] });
	},
);

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
