import { describe, test } from 'vitest';
import {
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectAnyWorkflowSkillInvoked,
  getEvalContext,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
} from '#test-utils';

// The steps of the workflow in AGENTS.md that this task cannot do without.
const WORKFLOW_SKILLS = ['write-stories', 'test-stories', 'ui-review'];

describe('writing stories for an existing AlertBanner', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['alertbanner'],
    });
  });

  test('runs the skill of each of these steps and publishes a display review', () => {
    expectWorkflowCalls([...WORKFLOW_SKILLS, 'review-create']);
    expectDisplayReviewForVisualChange();
  });

  test('the review covers the new AlertBanner stories', () => {
    expectStoryIdsInDisplayReview(['alertbanner']);
  });

  test('discovers stories through the workflow tools before publishing the review', () => {
    expectStoryDiscoveryBeforeReview();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

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
