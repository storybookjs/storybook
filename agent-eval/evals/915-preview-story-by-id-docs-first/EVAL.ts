import { describe, expect, test } from 'vitest';
import {
  expectWorkflowCalls,
  getWorkflowCalls,
  type StorybookWorkflowCall,
  workflowCallIncludesStory,
  workflowCallUsesStoryId,
} from '#test-utils';

describe('discovering story IDs before previewing Button stories by ID', () => {
  function includesStoryIds(call: StorybookWorkflowCall): boolean {
    return call.input.withStoryIds === true;
  }

  test('discovers story IDs before previewing by ID', () => {
    const previewCalls = getWorkflowCalls('stories-preview');
    expectWorkflowCalls(['docs-list', 'stories-preview']);
    expect(getWorkflowCalls('docs-list').some(includesStoryIds)).toBe(true);
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
