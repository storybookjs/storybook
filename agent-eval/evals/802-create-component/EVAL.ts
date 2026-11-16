import {
  expectAnyWorkflowSkillInvoked,
  expectNoDisplayReview,
  expectNoOtherTestRunner,
  expectReviewHint,
  expectStoriesPass,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';
import { describe, test } from 'vitest';

// The skills of the workflow in AGENTS.md that this task cannot do without. The tests are a
// command of the workflow, not a skill, and a review only comes when the user asks for one.
const WORKFLOW_SKILLS = ['component-docs', 'write-stories'];

describe('creating a ProfileCard component', () => {
  test('the stories of the change pass', async () => {
    await expectStoriesPass({
      covering: ['profilecard'],
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

    // Building the ProfileCard from Reshaped primitives requires the docs tools.
    test('uses the documentation tooling', () => expectWorkflowCalls(['docs-show']));

    test.skipIf(integration === 'mcp')('finds the workflow through the plugin skills', () => {
      expectAnyWorkflowSkillInvoked();
    });
  });
});
