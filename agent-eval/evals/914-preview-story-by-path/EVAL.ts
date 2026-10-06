import { describe, expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls, workflowCallIncludesStory } from '#test-utils';

describe('previewing Button stories by file path', () => {
  test('previews the requested stories from the file path prompt', () => {
    const previewCalls = getWorkflowCalls('stories-preview');
    expectWorkflowCalls(['stories-preview']);
    // Deliberately no storyId: this eval requires the path + export strategy,
    // and workflowCallIncludesStory would accept a storyId match on its own.
    expect(
      previewCalls.some((call) =>
        workflowCallIncludesStory(call, {
          absoluteStoryPath: 'stories/Button.stories.tsx',
          exportName: 'Primary',
        })
      )
    ).toBe(true);
    expect(
      previewCalls.some((call) =>
        workflowCallIncludesStory(call, {
          absoluteStoryPath: 'stories/Button.stories.tsx',
          exportName: 'Secondary',
        })
      )
    ).toBe(true);
  });
});
