import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls } from '#test-utils';

test('reruns story tests while fixing accessibility issues', () => {
  expectWorkflowCalls(['test-run']);
  expect(getWorkflowCalls('test-run').length).toBeGreaterThanOrEqual(2);
});
