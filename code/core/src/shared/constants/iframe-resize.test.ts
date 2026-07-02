import { describe, expect, it } from 'vitest';

import { RESPONSIVE_VIEWPORT_VALUE } from '../../viewport/constants.ts';
import { hasFixedViewportDimensions, iframeResizeDimensionsEqual } from './iframe-resize.ts';

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
