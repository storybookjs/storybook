import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/dist/compiled/loader-utils3/index.js', { spy: true });

import loaderUtils from 'next/dist/compiled/loader-utils3/index.js';
import { getFontFaceDeclarations } from './get-font-face-declarations.ts';

describe('getFontFaceDeclarations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loaderUtils.getHashDigest).mockReturnValue('font-test');
  });

  it('preserves the display option for a single local font', async () => {
    const result = await getFontFaceDeclarations({
      source: 'next/font/local',
      props: {
        src: './font.woff2',
        display: 'fallback',
        metaSrc: { fontReferenceId: 'font-asset', fontPath: 'font.woff2' },
      },
      fontFamily: 'LocalFont',
      filename: '/project/src/fonts.ts',
    });

    expect(result.fontFaceCSS).toContain('font-display: fallback;');
  });

  it('preserves the display option for every local font source', async () => {
    const result = await getFontFaceDeclarations({
      source: 'next/font/local',
      props: {
        src: [
          { path: './regular.woff2', weight: '400' },
          { path: './bold.woff2', weight: '700' },
        ],
        display: 'fallback',
        metaSrc: [
          {
            path: { fontReferenceId: 'regular', fontPath: 'regular.woff2' },
            weight: '400',
          },
          {
            path: { fontReferenceId: 'bold', fontPath: 'bold.woff2' },
            weight: '700',
          },
        ],
      },
      fontFamily: 'LocalFont',
      filename: '/project/src/fonts.ts',
    });

    expect(result.fontFaceCSS.match(/@font-face/g) ?? []).toHaveLength(2);
    expect(result.fontFaceCSS.match(/font-display: fallback;/g) ?? []).toHaveLength(2);
  });

  it('defaults display to swap when omitted', async () => {
    const result = await getFontFaceDeclarations({
      source: 'next/font/local',
      props: {
        src: './font.woff2',
        metaSrc: { fontReferenceId: 'font-asset', fontPath: 'font.woff2' },
      },
      fontFamily: 'LocalFont',
      filename: '/project/src/fonts.ts',
    });

    expect(result.fontFaceCSS).toContain('font-display: swap;');
  });
});
