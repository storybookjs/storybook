import {
  expectAnyWorkflowSkillInvoked,
  expectDevServerLeftRunning,
  expectDisplayReviewForVisualChange,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';
import { describe, test } from 'vitest';

// The 803 task, with a review the user asks for: the skills of the workflow in AGENTS.md, and the
// ui-review skill, which the agent runs only when asked. Over MCP the agent has the review tool at
// hand, so there the review is what counts, not that it read the skill or found the stories the
// way the skill says.
const WORKFLOW_SKILLS = ['component-docs', 'write-stories'];

describe('editing ReviewCard and creating the review the user asks for', () => {
  const { integration } = getEvalContext();

  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['reviewcard'],
    });
  });

  test('runs the skills, and creates the review it was asked for', () => {
    expectWorkflowCalls([
      ...WORKFLOW_SKILLS,
      ...(integration === 'mcp' ? [] : ['ui-review']),
      'review-create',
    ]);
    expectDisplayReviewForVisualChange();
  });

  test('the review covers the edited ReviewCard component', () => {
    expectStoryIdsInDisplayReview(['reviewcard']);
  });

  test.skipIf(integration === 'mcp')(
    'discovers stories through the workflow tools before creating the review',
    () => {
      expectStoryDiscoveryBeforeReview();
    }
  );

  describe('depending on the current agent and integration', () => {
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
