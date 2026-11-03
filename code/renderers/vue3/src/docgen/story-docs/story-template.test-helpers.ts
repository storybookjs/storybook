import { expect } from 'vitest';

import { stripHoles } from 'storybook/internal/docs-tools';
import type { StoryDocsPayload } from 'storybook/internal/types';

/** Expects each story's template to print its snippet while no arg changes. */
export function expectTemplatesStripToSnippets(payload: StoryDocsPayload) {
  for (const story of Object.values(payload.stories)) {
    if (story.template !== undefined) {
      expect(stripHoles(story.template), story.id).toBe(story.snippet);
    }
  }
}
