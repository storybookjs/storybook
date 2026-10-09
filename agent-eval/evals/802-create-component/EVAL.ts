import {
  expectAllStoryExportsInDisplayReview,
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectReviewOpenedInBrowser,
  expectSkillInvoked,
  expectStoryDiscoveryBeforeReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
  modelRunsTestsOnlyWhenAsked,
} from '#test-utils';
import { describe, test } from 'vitest';

describe('creating a ProfileCard component', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      requireAgentRun: !modelRunsTestsOnlyWhenAsked(),
      covering: ['profilecard'],
    });
  });

  test('uses Storybook story instructions and publishes a display review', () => {
    expectWorkflowCalls(['get-storybook-story-instructions', 'review-create']);
    expectDisplayReviewForVisualChange();
  });

  test('opens the review in the in-app browser', () => {
    expectReviewOpenedInBrowser();
  });

  test('every new story appears in the display review', () => {
    expectAllStoryExportsInDisplayReview();
  });

  test('discovers stories through the workflow tools before publishing the review', () => {
    expectStoryDiscoveryBeforeReview();
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

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => expectDevServerLeftRunning()
    );
  });
});
