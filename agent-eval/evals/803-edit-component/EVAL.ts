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

describe('editing ReviewCard to add date and optional onReport', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['reviewcard'],
    });
  });

  test('uses Storybook story instructions and publishes a display review', () => {
    expectWorkflowCalls(['ui-workflow', 'review-create']);
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

    test.skipIf(integration === 'mcp')('invokes the ui-workflow skill', () => {
      expectSkillInvoked('ui-workflow');
    });

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => {
        expectDevServerLeftRunning();
      }
    );
  });
});
