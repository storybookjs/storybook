import { SourceType } from './shared.ts';
import { expectsStoryDocsCodePanelSnippet, shouldSkipStoryDocsEmit } from './storyDocsCodePanel.ts';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

describe('storyDocsCodePanel', () => {
  const originalFeatures = globalThis.FEATURES;

  beforeEach(() => {
    globalThis.FEATURES = { experimentalDocgenServer: true };
  });

  afterEach(() => {
    globalThis.FEATURES = originalFeatures;
  });

  describe('expectsStoryDocsCodePanelSnippet', () => {
    it('is true for args stories when experimentalDocgenServer is enabled', () => {
      expect(expectsStoryDocsCodePanelSnippet({ __isArgsStory: true })).toBe(true);
    });

    it('is false when experimentalDocgenServer is disabled', () => {
      globalThis.FEATURES = { experimentalDocgenServer: false };
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
});
