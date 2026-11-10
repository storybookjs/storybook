import {
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectSkillInvoked,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';
import { describe, test } from 'vitest';

// The steps of the workflow in AGENTS.md that this task goes through.
const WORKFLOW_SKILLS = ['component-docs', 'write-stories', 'test-stories', 'ui-review'];

describe('editing ReviewCard to add date and optional onReport', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['reviewcard'],
    });
  });

  test('runs the skill of every workflow step and publishes a display review', () => {
    expectWorkflowCalls([...WORKFLOW_SKILLS, 'review-create']);
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

    test.skipIf(integration === 'mcp')('invokes the skill of every workflow step', () => {
      for (const skill of WORKFLOW_SKILLS) {
        expectSkillInvoked(skill);
      }
    });

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => {
        expectDevServerLeftRunning();
      }
    );
  });
});
