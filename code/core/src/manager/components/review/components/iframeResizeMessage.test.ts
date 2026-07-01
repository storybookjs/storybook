import { describe, expect, it } from 'vitest';

import { IFRAME_RESIZE_CONTEXT } from '../../../../shared/constants/iframe-resize.ts';
import {
  computeThumbnailScale,
  parseIframeResizeMessage,
  THUMBNAIL_BOOTSTRAP_SCALE,
} from './iframeResizeMessage.ts';

describe('parseIframeResizeMessage', () => {
  it('accepts valid resize payloads', () => {
    expect(
      parseIframeResizeMessage(
        JSON.stringify({ context: IFRAME_RESIZE_CONTEXT, width: 320, height: 240 })
      )
    ).toEqual({ width: 320, height: 240 });
    expect(
      parseIframeResizeMessage({ context: IFRAME_RESIZE_CONTEXT, width: 320, height: 240 })
    ).toEqual({ width: 320, height: 240 });
  });

  it('rejects malformed payloads', () => {
    expect(parseIframeResizeMessage('{')).toBeNull();
    expect(parseIframeResizeMessage({ context: 'other', width: 320, height: 240 })).toBeNull();
    expect(
      parseIframeResizeMessage({ context: IFRAME_RESIZE_CONTEXT, width: -1, height: 240 })
    ).toBeNull();
    expect(
      parseIframeResizeMessage({ context: IFRAME_RESIZE_CONTEXT, width: 0, height: 240 })
    ).toBeNull();
    expect(
      parseIframeResizeMessage({ context: IFRAME_RESIZE_CONTEXT, width: NaN, height: 240 })
    ).toBeNull();
  });
});

describe('computeThumbnailScale', () => {
  it('uses 0.5 bootstrap scale before embed measurement', () => {
    expect(THUMBNAIL_BOOTSTRAP_SCALE).toBe(0.5);
  });

  it('rounds width fit down to 0.25 steps with a 0.5 floor', () => {
    expect(computeThumbnailScale(298, 293)).toBe(0.75);
    expect(computeThumbnailScale(200, 293)).toBe(1);
    expect(computeThumbnailScale(800, 293)).toBe(0.5);
  });

  it('does not shrink tall content that already fits the frame width', () => {
    expect(computeThumbnailScale(298, 293)).toBe(0.75);
    expect(computeThumbnailScale(298, 388)).toBe(1);
  });
});
