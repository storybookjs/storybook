import { describe, test } from 'vitest';
import {
  expectAnyWorkflowSkillInvoked,
  expectFocusedTestRunWithFiles,
  expectNoDisplayReview,
  expectNoOtherTestRunner,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';

// The skills of the workflow in AGENTS.md that this task cannot do without. The tests are a
// command of the workflow, not a skill, and a review only comes when the user asks for one.
const WORKFLOW_SKILLS = ['write-stories'];

describe('writing the first Button stories in an empty Storybook', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['button'],
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

    test.skipIf(integration === 'mcp')('finds the workflow through the plugin skills', () => {
      expectAnyWorkflowSkillInvoked();
    });
  });
});
