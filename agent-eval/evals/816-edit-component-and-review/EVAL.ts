import {
  expectAnyWorkflowSkillInvoked,
  expectDevServerLeftRunning,
  expectDisplayReviewForVisualChange,
  expectNoOtherTestRunner,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoriesPass,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';
import { describe, test } from 'vitest';

// The 803 task, with a review the user asks for: the skills of the workflow in AGENTS.md, and the
// ui-review skill, which the agent runs only when asked.
const WORKFLOW_SKILLS = ['component-docs', 'write-stories', 'ui-review'];

describe('editing ReviewCard and creating the review the user asks for', () => {
  test('the stories of the change pass', async () => {
    await expectStoriesPass({
      covering: ['reviewcard'],
    });
  });

  test('runs the skills, tests only through Storybook, and creates the review it was asked for', () => {
    expectWorkflowCalls([...WORKFLOW_SKILLS, 'review-create']);
    expectNoOtherTestRunner();
    expectDisplayReviewForVisualChange();
  });

  test('the review covers the edited ReviewCard component', () => {
    expectStoryIdsInDisplayReview(['reviewcard']);
  });

  test('discovers stories through the workflow tools before creating the review', () => {
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
