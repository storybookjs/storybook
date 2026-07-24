import { test } from 'vitest';
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

const review = isReviewEnabled();

// The edit pulls in a new Reshaped component (Button), which requires the
// docs tools; codex is an accepted known failure here (skipped the docs
// tools under both instruction shapes, CI run 28660377980, 2026-07-03).
test.skipIf(getEvalContext().agent === 'codex')('uses the documentation tooling', () => {
  expectWorkflowCalls(['get-documentation']);
});

test.runIf(review)('uses Storybook story instructions and publishes a display review', () => {
  expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
  expectDisplayReviewForVisualChange();
});

test.runIf(review)('the review covers the edited ReviewCard component', () => {
  expectStoryIdsInDisplayReview(['reviewcard']);
});

test.runIf(!review)('uses Storybook story instructions and previews the edited component', () => {
  expectWorkflowCalls(['get-storybook-story-instructions']);
  expectPreviewStoriesWithFinalLinks({ covering: ['reviewcard'] });
});

test.runIf(review)(
  'discovers stories through the workflow tools before publishing the review',
  () => {
    expectStoryDiscoveryBeforeReview();
  }
);

test('runs story tests after the change and finishes with them passing', () => {
  expectStoryTestsRanAndPassed({ covering: ['reviewcard'] });
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
