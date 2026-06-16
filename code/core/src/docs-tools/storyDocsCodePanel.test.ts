import { SourceType } from './shared.ts';
import { shouldSkipStoryDocsEmit, shouldWaitForServiceSnippet } from './storyDocsCodePanel.ts';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('storyDocsCodePanel', () => {
  beforeEach(() => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('shouldSkipStoryDocsEmit', () => {
    it('skips non-args stories', () => {
      expect(shouldSkipStoryDocsEmit({ __isArgsStory: false })).toBe(true);
    });
  });

  describe('shouldWaitForServiceSnippet', () => {
    it('is false when experimentalDocgenServer is disabled', () => {
      vi.stubGlobal('FEATURES', { experimentalDocgenServer: false });
      expect(shouldWaitForServiceSnippet(undefined, false)).toBe(false);
    });

    it('waits while the story is not prepared yet (emit decision unknown)', () => {
      // Parameters lack `__isArgsStory` until the story is prepared; falling back to raw CSF here
      // is what causes the flicker, so we must keep waiting.
      expect(shouldWaitForServiceSnippet(undefined, false)).toBe(true);
    });

    it('waits for prepared args stories that will receive a snippet', () => {
      expect(shouldWaitForServiceSnippet({ __isArgsStory: true }, true)).toBe(true);
    });

    it('does not wait for prepared stories that skip the service snippet', () => {
      expect(shouldWaitForServiceSnippet({ __isArgsStory: false }, true)).toBe(false);
    });
  });
});
