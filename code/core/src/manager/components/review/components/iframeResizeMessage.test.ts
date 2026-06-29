import { describe, expect, it } from 'vitest';

import { computeThumbnailScale } from './iframeResizeMessage.ts';

describe('computeThumbnailScale', () => {
  it('rounds width fit down to 0.25 steps with a 0.5 floor', () => {
    expect(computeThumbnailScale(298, 200, 293)).toBe(0.75);
    expect(computeThumbnailScale(200, 100, 293)).toBe(1);
    expect(computeThumbnailScale(800, 200, 293)).toBe(0.5);
  });

  it('uses height when content is taller than the 3/2 frame', () => {
    expect(computeThumbnailScale(298, 547, 293)).toBe(0.5);
  });
});
