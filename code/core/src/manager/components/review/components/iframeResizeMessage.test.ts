import { describe, expect, it } from 'vitest';

import {
  computeThumbnailMinHeight,
  computeThumbnailScale,
  computeThumbnailThirds,
} from './iframeResizeMessage.ts';

describe('computeThumbnailScale', () => {
  it('rounds fit down to 0.25 steps with a 0.5 floor', () => {
    expect(computeThumbnailScale(298, 293)).toBe(0.75);
    expect(computeThumbnailScale(200, 293)).toBe(1);
    expect(computeThumbnailScale(800, 293)).toBe(0.5);
  });
});

describe('computeThumbnailThirds', () => {
  it('picks the 3/4 bucket for tall ActionList-like content', () => {
    expect(computeThumbnailThirds(298, 547, 293)).toBe(4);
  });
});

describe('computeThumbnailMinHeight', () => {
  it('matches the 3/4 frame height at a known cell width', () => {
    expect(computeThumbnailMinHeight(298, 547, 293)).toBeCloseTo((293 * 4) / 3, 5);
  });
});
