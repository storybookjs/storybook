import { describe, expect, it } from 'vitest';

import { IFRAME_RESIZE_CONTEXT } from '../../../../shared/constants/iframe-resize.ts';
import { computeThumbnailScale, parseIframeResizeMessage } from './iframeResizeMessage.ts';

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
  it('rounds width fit down to 0.25 steps with a 0.5 floor', () => {
    expect(computeThumbnailScale(298, 200, 293)).toBe(0.75);
    expect(computeThumbnailScale(200, 100, 293)).toBe(1);
    expect(computeThumbnailScale(800, 200, 293)).toBe(0.5);
  });

  it('uses height when content is taller than the 3/2 frame', () => {
    expect(computeThumbnailScale(298, 547, 293)).toBe(0.5);
  });
});
