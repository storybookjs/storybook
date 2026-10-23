import { describe, expect, it, vi } from 'vitest';

vi.mock('next/dist/compiled/loader-utils3/index.js', () => ({
  default: { getHashDigest: () => 'font-test' },
}));

import { getFontFaceDeclarations } from './get-font-face-declarations.ts';

describe('getFontFaceDeclarations', () => {
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

  it('preserves the display option for each local font source', async () => {
    const result = await getFontFaceDeclarations({
      source: 'next/font/local',
      props: {
        src: [{ path: './regular.woff2', weight: '400' }],
        metaSrc: [{ path: { fontReferenceId: 'regular', fontPath: 'regular.woff2' }, weight: '400' }],
      },
      fontFamily: 'LocalFont',
      filename: '/project/src/fonts.ts',
    });

    expect(result.fontFaceCSS).toContain('font-display: swap;');
  });
});
