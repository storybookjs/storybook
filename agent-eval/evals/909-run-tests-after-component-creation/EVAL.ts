import { describe, expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls, type StorybookWorkflowCall } from '#test-utils';

describe('creating StatusPill stories and running focused story tests', () => {
  // A focused run: story ids, story files, or the changed stories.
  function hasStoriesInput(call: StorybookWorkflowCall): boolean {
    const { stories, files, changed } = call.input;
    return (
      (Array.isArray(stories) && stories.length > 0) ||
      (Array.isArray(files) && files.length > 0) ||
      Boolean(changed)
    );
  }

  test('creates stories, runs focused story tests, and previews the stories', () => {
    expectWorkflowCalls(['write-stories', 'test-run', 'stories-preview']);
    expect(getWorkflowCalls('test-run').some(hasStoriesInput)).toBe(true);
  });
});
