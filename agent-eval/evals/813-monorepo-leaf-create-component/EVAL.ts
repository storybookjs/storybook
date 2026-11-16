import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  expectAnyWorkflowSkillInvoked,
  expectNoDisplayReview,
  expectNoOtherTestRunner,
  expectReviewHint,
  expectStoriesPass,
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

  test('the stories of the change pass', async () => {
    await expectStoriesPass({
      covering: ['callout'],
      cwd: 'packages/ui',
    });
  });

  test('runs the skills of the workflow, tests only through Storybook, and creates no review unasked', () => {
    expectWorkflowCalls(WORKFLOW_SKILLS);
    expectNoOtherTestRunner();
    expectNoDisplayReview();
  });

  test('tells the user about the /ui-review skill', () => {
    expectReviewHint();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    test.skipIf(integration === 'mcp')('finds the workflow through the plugin skills', () => {
      expectAnyWorkflowSkillInvoked();
    });
  });
});
