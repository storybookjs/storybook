import { describe, expect, it } from 'vitest';

import { RESPONSIVE_VIEWPORT_VALUE } from '../../viewport/constants.ts';
import {
  hasFixedViewportDimensions,
  IFRAME_RESIZE_CONTEXT,
  iframeResizeDimensionsEqual,
  parseIframeResizeMessage,
} from './iframe-resize.ts';

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

describe('hasFixedViewportDimensions', () => {
  it('accepts named viewports with pixel dimensions', () => {
    expect(
      hasFixedViewportDimensions({
        name: 'Small mobile',
        value: 'mobile1',
        width: 320,
        height: 568,
      })
    ).toBe(true);
  });

  it('rejects the responsive viewport value', () => {
    expect(
      hasFixedViewportDimensions({
        name: 'Responsive',
        value: RESPONSIVE_VIEWPORT_VALUE,
        width: 800,
        height: 600,
      })
    ).toBe(false);
  });
});

describe('iframeResizeDimensionsEqual', () => {
  it('compares viewport metadata', () => {
    expect(
      iframeResizeDimensionsEqual(
        {
          width: 120,
          height: 48,
          viewport: { name: 'Small mobile', value: 'mobile1', width: 320, height: 568 },
        },
        {
          width: 120,
          height: 48,
          viewport: { name: 'Small mobile', value: 'mobile1', width: 320, height: 568 },
        }
      )
    ).toBe(true);
    expect(
      iframeResizeDimensionsEqual(
        { width: 120, height: 48 },
        {
          width: 120,
          height: 48,
          viewport: { name: 'Small mobile', value: 'mobile1', width: 320, height: 568 },
        }
      )
    ).toBe(false);
  });
});
