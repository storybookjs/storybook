import { describe, expect, test } from 'vitest';
import {
  expectWorkflowCalls,
  getWorkflowCalls,
  workflowCallIncludesStory,
  workflowCallUsesStoryId,
} from '#test-utils';

describe('previewing Button stories by story ID', () => {
  test('previews stories using story IDs', () => {
    const previewCalls = getWorkflowCalls('stories-preview');
    expectWorkflowCalls(['stories-preview']);
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
});
