import { describe, expect, it } from 'vitest';

import { IFRAME_RESIZE_CONTEXT } from '../../../../shared/constants/iframe-resize.ts';
import {
  getPreviewFrameStyle,
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
    expect(
      parseIframeResizeMessage({
        context: IFRAME_RESIZE_CONTEXT,
        width: 320,
        height: 240,
        viewport: { name: 'Small mobile', value: 'mobile1', width: 320, height: 568 },
      })
    ).toEqual({
      width: 320,
      height: 240,
      viewport: { name: 'Small mobile', value: 'mobile1', width: 320, height: 568 },
    });
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
    expect(
      parseIframeResizeMessage({
        context: IFRAME_RESIZE_CONTEXT,
        width: 320,
        height: 240,
        viewport: { name: 'Small mobile', value: 'mobile1' },
      })
    ).toEqual({
      width: 320,
      height: 240,
      viewport: { name: 'Small mobile', value: 'mobile1' },
    });
    expect(
      parseIframeResizeMessage({
        context: IFRAME_RESIZE_CONTEXT,
        width: 320,
        height: 240,
        viewport: { value: 'mobile1', width: 320, height: 568 },
      })
    ).toBeNull();
  });
});

describe('getPreviewFrameStyle', () => {
  it('bootstraps before resize', () => {
    expect(getPreviewFrameStyle(null)).toEqual({ '--scale': THUMBNAIL_BOOTSTRAP_SCALE });
  });

  it('uses viewport dimensions for fixed viewports', () => {
    expect(
      getPreviewFrameStyle({
        width: 120,
        height: 48,
        viewport: { name: 'Small mobile', value: 'mobile1', width: 320, height: 568 },
      })
    ).toEqual({ '--vp-w': 320, '--vp-h': 568 });
  });

  it('uses content width for responsive viewports', () => {
    expect(getPreviewFrameStyle({ width: 320, height: 240 })).toEqual({ '--content-w': 320 });
  });
});

describe('THUMBNAIL_BOOTSTRAP_SCALE', () => {
  it('widens the embed viewport to 2× the frame width before measurement', () => {
    expect(THUMBNAIL_BOOTSTRAP_SCALE).toBe(0.5);
  });
});
