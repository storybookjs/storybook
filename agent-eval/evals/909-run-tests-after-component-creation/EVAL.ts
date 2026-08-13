import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls, type StorybookWorkflowCall } from '#test-utils';

function hasStoriesInput(call: StorybookWorkflowCall): boolean {
  return Array.isArray(call.input.stories) && call.input.stories.length > 0;
}

test('creates stories, runs focused story tests, and previews the stories', () => {
  expectWorkflowCalls(['get-storybook-story-instructions', 'test-run', 'stories-preview']);
  expect(getWorkflowCalls('test-run').some(hasStoriesInput)).toBe(true);
});
