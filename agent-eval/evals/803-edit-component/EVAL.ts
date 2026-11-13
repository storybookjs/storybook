import {
  expectAnyWorkflowSkillInvoked,
  expectFocusedTestRunWithFiles,
  expectNoDisplayReview,
  expectNoOtherTestRunner,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';
import { describe, test } from 'vitest';

// The skills of the workflow in AGENTS.md that this task cannot do without. The tests are a
// command of the workflow, not a skill, and a review only comes when the user asks for one.
const WORKFLOW_SKILLS = ['component-docs', 'write-stories'];

describe('editing ReviewCard to add date and optional onReport', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['reviewcard'],
    });
  });

  test('runs the skills of the workflow, tests the files it changed, and publishes no review unasked', () => {
    expectWorkflowCalls(WORKFLOW_SKILLS);
    expectFocusedTestRunWithFiles();
    expectNoOtherTestRunner();
    expectNoDisplayReview();
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
  });
});
