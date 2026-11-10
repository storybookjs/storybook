import {
  expectAllStoryExportsInDisplayReview,
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectSkillInvoked,
  expectStoryDiscoveryBeforeReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';
import { describe, test } from 'vitest';

// The steps of the workflow in AGENTS.md that this task goes through.
const WORKFLOW_SKILLS = ['component-docs', 'write-stories', 'test-stories', 'ui-review'];

describe('creating a ProfileCard component', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['profilecard'],
    });
  });

  test('runs the skill of every workflow step and publishes a display review', () => {
    expectWorkflowCalls([...WORKFLOW_SKILLS, 'review-create']);
    expectDisplayReviewForVisualChange();
  });

  test('every new story appears in the display review', () => {
    expectAllStoryExportsInDisplayReview();
  });

  test('discovers stories through the workflow tools before publishing the review', () => {
    expectStoryDiscoveryBeforeReview();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    // Building the ProfileCard from Reshaped primitives requires the docs tools.
    test('uses the documentation tooling', () => expectWorkflowCalls(['docs-show']));

    test.skipIf(integration === 'mcp')('invokes the skill of every workflow step', () => {
      for (const skill of WORKFLOW_SKILLS) {
        expectSkillInvoked(skill);
      }
    });

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => expectDevServerLeftRunning()
    );
  });
});
