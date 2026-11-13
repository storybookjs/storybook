import {
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectAnyWorkflowSkillInvoked,
  expectFocusedTestRunWithFiles,
  expectNoOtherTestRunner,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';
import { describe, test } from 'vitest';

// The 803 task, with a review the user asks for: the skills of the workflow in AGENTS.md, and the
// ui-review skill, which the agent runs only when asked.
const WORKFLOW_SKILLS = ['component-docs', 'write-stories', 'ui-review'];

describe('editing ReviewCard and publishing the review the user asks for', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['reviewcard'],
    });
  });

  test('runs the skills, tests the files it changed, and publishes the review it was asked for', () => {
    expectWorkflowCalls([...WORKFLOW_SKILLS, 'review-create']);
    expectFocusedTestRunWithFiles();
    expectNoOtherTestRunner();
    expectDisplayReviewForVisualChange();
  });

  test('the review covers the edited ReviewCard component', () => {
    expectStoryIdsInDisplayReview(['reviewcard']);
  });

  test('discovers stories through the workflow tools before publishing the review', () => {
    expectStoryDiscoveryBeforeReview();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    // The edit pulls in a new Reshaped component (Button), which requires the
    // docs tools.
    test('uses the documentation tooling', () => {
      expectWorkflowCalls(['docs-show']);
    });

    test.skipIf(integration === 'mcp')('finds the workflow through the plugin skills', () => {
      expectAnyWorkflowSkillInvoked();
    });

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => {
        expectDevServerLeftRunning();
      }
    );
  });
});
