import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls } from '#test-utils';

test('reruns story tests after fixing failures and previews the stories', () => {
  expectWorkflowCalls(['test-run', 'stories-preview']);
  expect(getWorkflowCalls('test-run').length).toBeGreaterThanOrEqual(2);
});
