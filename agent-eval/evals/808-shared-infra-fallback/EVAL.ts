import {
  expectAnyWorkflowSkillInvoked,
  expectFocusedTestRunWithFiles,
  expectNoDisplayReview,
  expectNoOtherTestRunner,
  expectStoryTestsRanAndPassed,
  getEvalContext,
} from '#test-utils';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('changing a shared accent token and testing its consumer stories', () => {
  // The edited token file has no stories of its own, so the test run must cover
  // the stories of its *consumers* (Badge and StatusPill).

  // The fallback assertions only count if the token change was actually done.
  test('changes the accent color token', () => {
    const colors = readFileSync('src/theme/colors.ts', 'utf8');
    expect(colors, 'Expected the accent token to change to #7c3aed').toMatch(/#7c3aed/i);
    expect(colors, 'Expected the old accent value #2563eb to be gone').not.toMatch(/#2563eb/i);
  });

  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['badge', 'statuspill'],
    });
  });

  // The tests of the token file select the stories of its consumers, so the agent needs no story
  // ids for them.
  test('tests the files it changed, and publishes no review unasked', () => {
    expectFocusedTestRunWithFiles();
    expectNoOtherTestRunner();
    expectNoDisplayReview();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    test.skipIf(integration === 'mcp')('finds the workflow through the plugin skills', () => {
      expectAnyWorkflowSkillInvoked();
    });
  });
});
