import {
  expectDisplayReviewForVisualChange,
  expectPreviewBrowserStarted,
  expectPreviewStoriesWithFinalLinks,
  expectSkillInvoked,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectValidStorybookLaunchConfig,
  expectWorkflowCalls,
  getEvalContext,
  isReviewEnabled,
} from '#test-utils';
import { describe, test } from 'vitest';

describe('editing ReviewCard to add date and optional onReport', () => {
  const review = isReviewEnabled();

  test('runs story tests after the change and finishes with them passing', () => {
    expectStoryTestsRanAndPassed({ covering: ['reviewcard'] });
  });

  describe.runIf(review)('when review is enabled', () => {
    test('uses Storybook story instructions and publishes a display review', () => {
      expectWorkflowCalls(['get-storybook-story-instructions', 'review-create']);
      expectDisplayReviewForVisualChange();
    });

    test('the review covers the edited ReviewCard component', () => {
      expectStoryIdsInDisplayReview(['reviewcard']);
    });

    test('discovers stories through the workflow tools before publishing the review', () => {
      expectStoryDiscoveryBeforeReview();
    });
  });

  describe.runIf(!review)('when review is disabled', () => {
    test('uses Storybook story instructions and previews the edited component', () => {
      expectWorkflowCalls(['get-storybook-story-instructions']);
      expectPreviewStoriesWithFinalLinks({ covering: ['reviewcard'] });
    });
  });

  describe('depending on the current agent and integration', () => {
    const { agent, integration } = getEvalContext();

    // The edit pulls in a new Reshaped component (Button), which requires the
    // docs tools. Skipped for Codex: it omits docs-show under both
    // instruction shapes (CI 28660377980, 2026-07-03). Re-enable after the
    // documentation tool call passes on three consecutive scheduled CI runs.
    test.skipIf(agent === 'codex')('uses the documentation tooling', () => {
      expectWorkflowCalls(['docs-show']);
    });

    test.skipIf(integration === 'mcp')('invokes the stories skill', () => {
      expectSkillInvoked('stories');
    });

    test.skipIf(agent !== 'claude-code' || integration !== 'plugin')(
      'keeps the pre-existing Storybook launch config valid',
      () => {
        expectValidStorybookLaunchConfig();
      }
    );

    test.skipIf(integration !== 'plugin')('opens the preview browser when using the plugin', () => {
      expectPreviewBrowserStarted();
    });
  });
});
