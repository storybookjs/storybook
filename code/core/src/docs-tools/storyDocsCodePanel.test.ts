import { SourceType } from './shared.ts';
import {
  expectsStoryDocsCodePanelSnippet,
  shouldSkipStoryDocsEmit,
  shouldWaitForServiceSnippet,
} from './storyDocsCodePanel.ts';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('storyDocsCodePanel', () => {
  beforeEach(() => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('expectsStoryDocsCodePanelSnippet', () => {
    it('is true for args stories when experimentalDocgenServer is enabled', () => {
      expect(expectsStoryDocsCodePanelSnippet({ __isArgsStory: true })).toBe(true);
    });

    it('is false when experimentalDocgenServer is disabled', () => {
      vi.stubGlobal('FEATURES', { experimentalDocgenServer: false });
      expect(expectsStoryDocsCodePanelSnippet({ __isArgsStory: true })).toBe(false);
    });

    it('is false when story-docs emit is skipped', () => {
      expect(
        expectsStoryDocsCodePanelSnippet({
          __isArgsStory: true,
          docs: { source: { type: SourceType.CODE } },
        })
      ).toBe(false);
    });
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
