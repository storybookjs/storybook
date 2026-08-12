import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls } from '#test-utils';

test('reruns story tests while fixing accessibility issues', () => {
  expectWorkflowCalls(['run-story-tests']);
  expect(getWorkflowCalls('run-story-tests').length).toBeGreaterThanOrEqual(2);
});
