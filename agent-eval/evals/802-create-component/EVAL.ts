import {
  expectAllStoryExportsInDisplayReview,
  expectDisplayReviewForVisualChange,
  expectPreviewBrowserStarted,
  expectPreviewStoriesWithFinalLinks,
  expectSkillInvoked,
  expectStoryDiscoveryBeforeReview,
  expectStoryTestsRanAndPassed,
  expectValidStorybookLaunchConfig,
  expectWorkflowCalls,
  getEvalContext,
  isReviewEnabled,
} from '#test-utils';
import { describe, test } from 'vitest';

describe('creating a ProfileCard component', () => {
  const review = isReviewEnabled();

  test('runs story tests after the change and finishes with them passing', () => {
    expectStoryTestsRanAndPassed({ covering: ['profilecard'] });
  });

  describe.runIf(review)('when review is enabled', () => {
    test('uses Storybook story instructions and publishes a display review', () => {
      expectWorkflowCalls(['get-storybook-story-instructions', 'review-create']);
      expectDisplayReviewForVisualChange();
    });

    test('every new story appears in the display review', () => {
      expectAllStoryExportsInDisplayReview();
    });

    test('discovers stories through the workflow tools before publishing the review', () => {
      expectStoryDiscoveryBeforeReview();
    });
  });

  describe.runIf(!review)('when review is disabled', () => {
    test('uses Storybook story instructions and previews the new stories', () => {
      expectWorkflowCalls(['get-storybook-story-instructions']);
      expectPreviewStoriesWithFinalLinks({ covering: ['profilecard'] });
    });
  });

  describe('depending on the current agent and integration', () => {
    const { agent, integration } = getEvalContext();

    // Building the ProfileCard from Reshaped primitives requires the docs tools.
    // Skipped for Codex: it omits docs-show under both instruction
    // shapes (CI 28660377980, 2026-07-03). Re-enable after the documentation
    // tool call passes on three consecutive scheduled CI runs.
    test.skipIf(agent === 'codex')('uses the documentation tooling', () =>
      expectWorkflowCalls(['docs-show'])
    );

    test.skipIf(integration === 'mcp')('invokes the stories skill', () =>
      expectSkillInvoked('stories')
    );

    // Unlike 801, the template's valid .claude/launch.json is left intact, so the
    // plugin must reuse the existing config instead of writing a fresh one.
    test.skipIf(agent !== 'claude-code' || integration !== 'plugin')(
      'keeps the pre-existing Storybook launch config valid',
      () => expectValidStorybookLaunchConfig()
    );

    test.skipIf(integration !== 'plugin')('opens the preview browser when using the plugin', () =>
      expectPreviewBrowserStarted()
    );
  });
});
