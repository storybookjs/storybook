import { transcript } from '@vercel/agent-eval/eval';
import { describe, expect, test } from 'vitest';
import {
  A11Y_VISUAL_CHANGE_APPROVAL_CRITERION,
  expectWorkflowCalls,
  getWorkflowCalls,
} from '#test-utils';

describe('fixing accessibility violations found by story tests', () => {
  test('reruns story tests while fixing accessibility issues', () => {
    expectWorkflowCalls(['test-run']);
    expect(getWorkflowCalls('test-run').length).toBeGreaterThanOrEqual(2);
  });

  test('asks before visual accessibility changes', async () => {
    await expect(transcript).toScoreAtLeast(A11Y_VISUAL_CHANGE_APPROVAL_CRITERION, 0.8);
  });
});
