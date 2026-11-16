import { describe, test } from 'vitest';
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

describe('writing stories for an existing AlertBanner', () => {
  test('the stories of the change pass', async () => {
    await expectStoriesPass({
      covering: ['alertbanner'],
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
