import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  expectAnyWorkflowSkillInvoked,
  expectFocusedTestRun,
  expectNoDisplayReview,
  expectNoOtherTestRunner,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';

// The skills of the workflow in AGENTS.md that this task cannot do without. The tests are a
// command of the workflow, not a skill, and a review only comes when the user asks for one.
const WORKFLOW_SKILLS = ['write-stories'];

describe('creating a Callout in a monorepo UI package', () => {
  // Workflow asserts are enabled. The skills direct the dev server and
  // every Storybook CLI command to the package where Storybook is installed,
  // which avoids the degraded help output at the monorepo root (historical
  // context: storybookjs/storybook#35359).

  test('creates the component inside the leaf package', () => {
    expect(
      existsSync('packages/ui/src/components/Callout.tsx'),
      'Expected packages/ui/src/components/Callout.tsx to be created'
    ).toBe(true);
  });

  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['callout'],
      cwd: 'packages/ui',
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

    test.skipIf(integration === 'mcp')('finds the workflow through the plugin skills', () => {
      expectAnyWorkflowSkillInvoked();
    });
  });
});
