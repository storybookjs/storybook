import {
  expectAnyWorkflowSkillInvoked,
  expectDevServerLeftRunning,
  expectDisplayReviewForBrowseRequest,
  expectNoReviewHint,
  expectStoryIdsInDisplayReview,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';
import { describe, test } from 'vitest';

describe('browsing existing ReviewCard Storybook states', () => {
  test('creates a display review for a browse request without changed files', () => {
    expectDisplayReviewForBrowseRequest();
  });

  // The prompt asks for ALL ReviewCard states; the fixture is untouched by a
  // browse request, so the three story ids are stable and must all be shown.
  test('the review shows every existing ReviewCard story', () => {
    expectStoryIdsInDisplayReview([
      'reviewcard--default',
      'reviewcard--with-long-comment',
      'reviewcard--low-rating',
    ]);
  });

  test('leaves out the review line: nothing changed', () => {
    expectNoReviewHint();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    // Over MCP the review is what counts, not that the agent read the skill first.
    test.skipIf(integration === 'mcp')(
      'runs the ui-review skill for a request to see stories',
      () => {
        expectWorkflowCalls(['ui-review']);
      }
    );

    test.skipIf(integration === 'mcp')('finds the workflow through the plugin skills', () => {
      expectAnyWorkflowSkillInvoked();
    });

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => expectDevServerLeftRunning()
    );
  });
});
