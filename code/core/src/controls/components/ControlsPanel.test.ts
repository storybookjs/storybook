import { describe, expect, it } from 'vitest';

import { getCurrentStoryPreviewInitialized } from './controlsPanelState';

describe('getCurrentStoryPreviewInitialized', () => {
  it('uses the root preview state for local stories', () => {
    expect(getCurrentStoryPreviewInitialized(true, {}, { refId: undefined })).toBe(true);
    expect(getCurrentStoryPreviewInitialized(false, {}, undefined)).toBe(false);
  });

  it('uses the selected ref preview state for composed stories', () => {
    expect(
      getCurrentStoryPreviewInitialized(
        false,
        {
          external: { previewInitialized: true },
        },
        { refId: 'external' }
      )
    ).toBe(true);
  });

  it('returns false when the composed ref does not exist', () => {
    expect(getCurrentStoryPreviewInitialized(true, {}, { refId: 'nonexistent' })).toBe(false);
  });

  it('returns false when the composed ref is not initialized', () => {
    expect(
      getCurrentStoryPreviewInitialized(
        true,
        {
          external: { previewInitialized: false },
        },
        { refId: 'external' }
      )
    ).toBe(false);
  });
});
