import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectSkillInvoked,
  getEvalContext,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
} from '#test-utils';

// The steps of the workflow in AGENTS.md that this task goes through.
const WORKFLOW_SKILLS = ['write-stories', 'test-stories', 'ui-review'];

describe('creating a Callout in a monorepo UI package', () => {
  // Workflow asserts are enabled. The skills direct the dev server and
  // every Storybook CLI command to the package where Storybook is installed,
  // which avoids the degraded help output at the monorepo root (historical
  // context: storybookjs/storybook#35359).

  test('creates the component inside the leaf package', () => {
    expect(
      existsSync('packages/ui/src/components/Callout.tsx'),
      'Expected packages/ui/src/components/Callout.tsx to be created'
    ).toBe(true);
  });

  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['callout'],
      cwd: 'packages/ui',
    });
  });

  test('runs the skill of every workflow step and publishes a display review', () => {
    expectWorkflowCalls([...WORKFLOW_SKILLS, 'review-create']);
    expectDisplayReviewForVisualChange();
  });

  test('the review covers the new Callout stories', () => {
    expectStoryIdsInDisplayReview(['callout']);
  });

  test('discovers stories through the workflow tools before publishing the review', () => {
    expectStoryDiscoveryBeforeReview();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

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
