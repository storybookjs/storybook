import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls, type StorybookWorkflowCall } from '#test-utils';

function runsAllStories(call: StorybookWorkflowCall): boolean {
  return (
    !('stories' in call.input) ||
    (Array.isArray(call.input.stories) && call.input.stories.length === 0)
  );
}

test('runs the full Storybook story test suite', () => {
  expectWorkflowCalls(['test-run']);
  expect(getWorkflowCalls('test-run').some(runsAllStories)).toBe(true);
});
