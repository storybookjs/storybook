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
} from '#test-utils';

// Monorepo-leaf project shape (Agentic Review Eval instructions §7, secondary
// axis): the runnable Storybook lives in the @acme/ui workspace package, not
// at the repo root, so the agent must work inside the leaf.
// Note: expectAllStoryExportsInDisplayReview assumes the project starts
// without story files, so it cannot be used here (Card ships with stories).

// TODO(storybookjs/storybook#35359): the workflow assertions below are
// test.todo until the CLI help bug is fixed. `storybook ai --help` run from
// the monorepo root cannot load the leaf's Storybook config and then hides
// every runtime workflow command — the only command it lists is `setup`, so
// agents derail into `setup` + raw vitest and never discover display-review
// (observed on both the Claude and Codex plugin paths in the 2026-07-02 runs;
// recovery via `--help --config-dir packages/ui/.storybook` is a coin flip).
// Re-enable by swapping test.todo back to test once #35359 lands.

test('creates the component inside the leaf package', () => {
	expect(
		existsSync('packages/ui/src/components/Callout.tsx'),
		'Expected packages/ui/src/components/Callout.tsx to be created',
	).toBe(true);
});

test.todo('publishes a display review for the new component', () => {
	expectWorkflowCalls(['display-review']);
	expectDisplayReviewForVisualChange();
});

test.todo('uses the Storybook story instructions', () => {
	expectWorkflowCalls(['get-storybook-story-instructions']);
});

test.todo('the review covers the new Callout stories', () => {
	expectStoryIdsInDisplayReview(['callout']);
});

test.todo('discovers stories through the workflow tools before publishing the review', () => {
	expectStoryDiscoveryBeforeReview();
});

test.todo('runs story tests after the change and finishes with them passing', () => {
	expectStoryTestsRanAndPassed({ covering: ['callout'] });
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
