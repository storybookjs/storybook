import { describe, expect, it } from 'vitest';

import { computeThumbnailLayout } from './computeThumbnailLayout.ts';

describe('computeThumbnailLayout', () => {
  it('uses full scale for narrow content', () => {
    expect(computeThumbnailLayout({ width: 200, height: 150 })).toEqual({
      scale: 1,
      aspectRatio: '3 / 2',
    });
  });

  it('uses half scale for wide content', () => {
    expect(computeThumbnailLayout({ width: 400, height: 400 })).toEqual({
      scale: 0.5,
      aspectRatio: '3 / 2',
    });
  });

  it('uses a wide frame for short scaled content', () => {
    expect(computeThumbnailLayout({ width: 200, height: 120 })).toEqual({
      scale: 1,
      aspectRatio: '2 / 1',
    });
    expect(computeThumbnailLayout({ width: 400, height: 200 })).toEqual({
      scale: 0.5,
      aspectRatio: '2 / 1',
    });
  });

  it('uses a tall frame for tall scaled content', () => {
    expect(computeThumbnailLayout({ width: 200, height: 300 })).toEqual({
      scale: 1,
      aspectRatio: '3 / 4',
    });
    expect(computeThumbnailLayout({ width: 400, height: 600 })).toEqual({
      scale: 0.5,
      aspectRatio: '3 / 4',
    });
  });

  it('uses the default frame in the middle height band', () => {
    expect(computeThumbnailLayout({ width: 200, height: 200 })).toEqual({
      scale: 1,
      aspectRatio: '3 / 2',
    });
  });
});
