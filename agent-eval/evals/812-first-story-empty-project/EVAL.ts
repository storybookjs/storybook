import { describe, test } from 'vitest';
import {
  expectAllStoryExportsInDisplayReview,
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectSkillInvoked,
  getEvalContext,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
} from '#test-utils';

// The steps of the workflow in AGENTS.md that this task cannot do without.
const WORKFLOW_SKILLS = ['write-stories', 'test-stories', 'ui-review'];

describe('writing the first Button stories in an empty Storybook', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['button'],
    });
  });

  test('runs the skill of each of these steps and publishes a display review', () => {
    expectWorkflowCalls([...WORKFLOW_SKILLS, 'review-create']);
    expectDisplayReviewForVisualChange();
  });

  test('the review covers the new Button stories', () => {
    expectStoryIdsInDisplayReview(['button']);
  });

  test('every new story appears in the display review', () => {
    expectAllStoryExportsInDisplayReview();
  });

  test('discovers stories through the workflow tools before publishing the review', () => {
    expectStoryDiscoveryBeforeReview();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    test.skipIf(integration === 'mcp')('invokes the skill of each of these steps', () => {
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
