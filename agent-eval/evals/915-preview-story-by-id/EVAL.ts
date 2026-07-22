import { expect, test } from 'vitest';
import {
  expectWorkflowCalls,
  getWorkflowCalls,
  workflowCallIncludesStory,
  workflowCallUsesStoryId,
} from '#test-utils';

test('previews stories using story IDs', () => {
  const previewCalls = getWorkflowCalls('preview-stories');
  expectWorkflowCalls(['preview-stories']);
  expect(previewCalls.some(workflowCallUsesStoryId)).toBe(true);
  expect(
    previewCalls.some((call) =>
      workflowCallIncludesStory(call, { storyId: 'example-button--primary' })
    )
  ).toBe(true);
  expect(
    previewCalls.some((call) =>
      workflowCallIncludesStory(call, { storyId: 'example-button--secondary' })
    )
  ).toBe(true);
});
