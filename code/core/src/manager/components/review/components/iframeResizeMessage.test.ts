import { describe, expect, it } from 'vitest';

import { IFRAME_RESIZE_CONTEXT } from '../../../../shared/constants/iframe-resize.ts';
import { parseIframeResizeMessage, THUMBNAIL_BOOTSTRAP_SCALE } from './iframeResizeMessage.ts';

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

describe('THUMBNAIL_BOOTSTRAP_SCALE', () => {
  it('widens the embed viewport to 2× the frame width before measurement', () => {
    expect(THUMBNAIL_BOOTSTRAP_SCALE).toBe(0.5);
  });
});
