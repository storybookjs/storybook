import {
  expectAnyWorkflowSkillInvoked,
  expectFocusedTestRun,
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

describe('creating an accessible ToggleSwitch', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['toggleswitch'],
    });
  });

  test('runs the skills of the workflow, tests what it changed, and publishes no review unasked', () => {
    expectWorkflowCalls(WORKFLOW_SKILLS);
    expectFocusedTestRun();
    expectNoOtherTestRunner();
    expectNoDisplayReview();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    // Building with external Reshaped components requires the docs tools: props
    // must not be guessed or read out of node_modules.
    test('uses the documentation tooling', () => expectWorkflowCalls(['docs-show']));

    test.skipIf(integration === 'mcp')('finds the workflow through the plugin skills', () => {
      expectAnyWorkflowSkillInvoked();
    });
  });
});
