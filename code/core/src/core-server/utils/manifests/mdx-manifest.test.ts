import { describe, expect, it } from 'vitest';

import { componentIdToStaticName } from '../../../shared/open-service/static-names.ts';
import {
  mdxDocJsonPointer,
  mdxManifestRef,
  mdxPayloadJsonPointer,
  mdxQueryStaticPath,
  mdxStaticStorePath,
} from './mdx-manifest.ts';

describe('mdx-manifest paths', () => {
  it('keeps manifest refs aligned with the MDX staticPath output', () => {
    expect(mdxQueryStaticPath('button')).toBe('button.json');
    expect(mdxStaticStorePath('button')).toBe('addon-docs/mdx/button.json');
    expect(mdxPayloadJsonPointer('button')).toBe('/components/button');
    expect(mdxDocJsonPointer('button', 'intro')).toBe('/components/button/docs/intro');
    expect(mdxManifestRef('button', 'intro')).toBe(
      '../services/addon-docs/mdx/button.json#/components/button/docs/intro'
    );
  });

  it('derives portable snapshot names for non-ASCII component ids', () => {
    // '😀' is the component id of the unicode template story
    // (code/core/template/stories/unicode.stories.ts); a CJK-titled component with an attached
    // .mdx file hits the same derivation. The raw ids must never become tar entry names.
    for (const id of ['😀', '按钮-组件', '界'.repeat(30)]) {
      expect(mdxQueryStaticPath(id)).toBe(`${componentIdToStaticName(id)}.json`);
      expect(mdxQueryStaticPath(id)).toMatch(/^id-[0-9a-f]{16}\.json$/);
      expect(mdxManifestRef(id, 'intro')).toBe(
        `../services/addon-docs/mdx/${componentIdToStaticName(id)}.json#/components/${id}/docs/intro`
      );
    }
  });
});
