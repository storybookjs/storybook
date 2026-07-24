import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  expectDisplayReviewForVisualChange,
  expectPreviewBrowserStarted,
  expectPreviewStoriesWithFinalLinks,
  expectSkillInvoked,
  getEvalContext,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectValidStorybookLaunchConfig,
  expectWorkflowCalls,
  isReviewEnabled,
} from '#test-utils';

// The workflow assertions below were test.todo while agents ran `storybook ai`
// from the monorepo root and hit the degraded help of
// storybookjs/storybook#35359 (still open). Re-enabled now that the stories
// skills direct the dev server and every `storybook ai` command to the
// package where Storybook is installed, which avoids the degraded-help path.

const review = isReviewEnabled();

test('creates the component inside the leaf package', () => {
  expect(
    existsSync('packages/ui/src/components/Callout.tsx'),
    'Expected packages/ui/src/components/Callout.tsx to be created'
  ).toBe(true);
});

test.runIf(review)('uses Storybook story instructions and publishes a display review', () => {
  expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
  expectDisplayReviewForVisualChange();
});

test.runIf(review)('the review covers the new Callout stories', () => {
  expectStoryIdsInDisplayReview(['callout']);
});

test.runIf(!review)('uses Storybook story instructions and previews the new stories', () => {
  expectWorkflowCalls(['get-storybook-story-instructions']);
  expectPreviewStoriesWithFinalLinks({ covering: ['callout'] });
});

test.runIf(review)(
  'discovers stories through the workflow tools before publishing the review',
  () => {
    expectStoryDiscoveryBeforeReview();
  }
);

test('runs story tests after the change and finishes with them passing', () => {
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
