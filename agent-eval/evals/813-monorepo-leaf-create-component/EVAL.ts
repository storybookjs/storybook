import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
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

// TODO(storybookjs/storybook#35359): the workflow assertions below are
// test.todo until the CLI help bug is fixed. `storybook ai --help` run from
// the monorepo root cannot load the leaf's Storybook config and then hides
// every runtime workflow command, so agents derail into `setup` + raw vitest
// and never discover display-review (both plugin paths, 2026-07-02 runs).
// Re-enable by swapping test.todo back to test once #35359 lands — and split
// them on isReviewEnabled() like the other 8xx evals (see 801/812).

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

test.skipIf(getEvalContext().integration === 'mcp')('invokes the stories skill', () => {
	expectSkillInvoked('stories');
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
