import { SourceType } from './shared.ts';
import { isStoryDocsSnippetEligible, shouldWaitForServiceSnippet } from './storyDocsCodePanel.ts';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('storyDocsCodePanel', () => {
  beforeEach(() => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isStoryDocsSnippetEligible', () => {
    it('accepts args stories without a source override', () => {
      expect(isStoryDocsSnippetEligible({ __isArgsStory: true })).toBe(true);
    });

    it('rejects non-args stories', () => {
      expect(isStoryDocsSnippetEligible({ __isArgsStory: false })).toBe(false);
    });

    it('rejects explicit source code, including an empty override', () => {
      expect(
        isStoryDocsSnippetEligible({
          __isArgsStory: true,
          docs: { source: { code: '' } },
        })
      ).toBe(false);
    });

    it('rejects CODE source type', () => {
      expect(
        isStoryDocsSnippetEligible({
          __isArgsStory: true,
          docs: { source: { type: SourceType.CODE } },
        })
      ).toBe(false);
    });

    it('accepts an explicit DYNAMIC source type for a non-args story', () => {
      expect(
        isStoryDocsSnippetEligible({
          __isArgsStory: false,
          docs: { source: { type: SourceType.DYNAMIC } },
        })
      ).toBe(true);
    });

    it('accepts a block-level DYNAMIC override for a non-args story', () => {
      expect(isStoryDocsSnippetEligible({ __isArgsStory: false }, SourceType.DYNAMIC)).toBe(true);
    });

    it('keeps explicit code authoritative over DYNAMIC', () => {
      expect(
        isStoryDocsSnippetEligible({
          __isArgsStory: true,
          docs: { source: { code: '', type: SourceType.DYNAMIC } },
        })
      ).toBe(false);
    });

    it('rejects portable stories even when the source would otherwise render dynamically', () => {
      expect(
        isStoryDocsSnippetEligible({
          __isArgsStory: true,
          __isPortableStory: true,
          docs: { source: { type: SourceType.DYNAMIC } },
        })
      ).toBe(false);
    });
  });

  describe('shouldWaitForServiceSnippet', () => {
    it('is false when experimentalDocgenServer is disabled', () => {
      vi.stubGlobal('FEATURES', { experimentalDocgenServer: false });
      expect(shouldWaitForServiceSnippet(undefined, false)).toBe(false);
    });

    it('waits while the story is not prepared yet (eligibility unknown)', () => {
      // Parameters lack `__isArgsStory` until the story is prepared; falling back to raw CSF here
      // is what causes the flicker, so we must keep waiting.
      expect(shouldWaitForServiceSnippet(undefined, false)).toBe(true);
    });

    it('waits for prepared args stories that will receive a snippet', () => {
      expect(shouldWaitForServiceSnippet({ __isArgsStory: true }, true)).toBe(true);
    });

    it('does not wait for prepared stories that are ineligible', () => {
      expect(shouldWaitForServiceSnippet({ __isArgsStory: false }, true)).toBe(false);
    });
  });
});
