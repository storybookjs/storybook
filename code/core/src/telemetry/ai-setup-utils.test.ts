import { describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import { isStoryCreatedByAISetup } from './ai-setup-utils.ts';

describe('isStoryCreatedByAISetup', () => {
  it('returns true for stories with the ai-generated tag', () => {
    expect(
      isStoryCreatedByAISetup({
        type: 'story',
        title: 'Foo',
        tags: ['ai-generated', 'dev', 'play-fn'],
      } as IndexEntry)
    ).toBe(true);
  });

  it('returns false for regular stories', () => {
    expect(isStoryCreatedByAISetup({ type: 'story', title: 'Foo' } as IndexEntry)).toBe(false);
  });
});
