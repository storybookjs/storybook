import { describe, expect, it } from 'vitest';

import { MINIMAL_VIEWPORTS } from './defaults.ts';
import {
  resolveViewport,
  toResolvedViewportDimensions,
  toViewportPixels,
} from './resolveViewport.ts';

describe('resolveViewport', () => {
  it('resolves a named viewport from story globals', () => {
    expect(
      resolveViewport({
        globals: { viewport: { value: 'mobile1' } },
        storyGlobals: { viewport: { value: 'mobile1' } },
        userGlobals: {},
        options: MINIMAL_VIEWPORTS,
        viewMode: 'story',
      })
    ).toMatchObject({
      name: 'Small mobile',
      value: 'mobile1',
      width: '320px',
      height: '568px',
    });
  });

  it('returns responsive defaults when no viewport is set', () => {
    expect(
      resolveViewport({
        globals: {},
        storyGlobals: {},
        userGlobals: {},
        options: MINIMAL_VIEWPORTS,
        viewMode: 'story',
      })
    ).toMatchObject({
      name: 'Responsive',
      isDefault: true,
      width: '100%',
      height: '100%',
    });
  });
});

describe('toViewportPixels', () => {
  it('parses pixel values', () => {
    expect(toViewportPixels('320px', 800)).toBe(320);
  });

  it('resolves percentage values against a reference', () => {
    expect(toViewportPixels('50%', 800)).toBe(400);
  });
});

describe('toResolvedViewportDimensions', () => {
  it('includes numeric dimensions when parseable', () => {
    const viewport = resolveViewport({
      globals: { viewport: { value: 'desktop' } },
      storyGlobals: { viewport: { value: 'desktop' } },
      userGlobals: {},
      options: MINIMAL_VIEWPORTS,
      viewMode: 'story',
    });

    expect(toResolvedViewportDimensions(viewport, { width: 800, height: 600 })).toEqual({
      name: 'Desktop',
      value: 'desktop',
      width: 1280,
      height: 1024,
    });
  });
});
