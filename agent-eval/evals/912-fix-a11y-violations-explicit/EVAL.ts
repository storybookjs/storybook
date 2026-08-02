import { describe, expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls } from '#test-utils';

describe('fixing accessibility violations found by story tests with an explicit prompt', () => {
  test('reruns story tests while fixing accessibility issues', () => {
    expectWorkflowCalls(['run-story-tests']);
    expect(getWorkflowCalls('run-story-tests').length).toBeGreaterThanOrEqual(2);
  });
});
