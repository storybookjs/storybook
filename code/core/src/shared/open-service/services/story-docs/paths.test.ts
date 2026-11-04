import { describe, expect, it } from 'vitest';

import { resolveStaticPath } from '../../service-runtime.ts';
import { storyDocsServiceDef } from './definition.ts';
import {
  storyDocsManifestRef,
  storyDocsPayloadJsonPointer,
  storyDocsQueryStaticPath,
  storyDocsStaticStorePath,
} from './paths.ts';

describe('story-docs paths', () => {
  it('keeps manifest refs aligned with storyDocs staticPath output', () => {
    expect(storyDocsQueryStaticPath('button')).toBe('button.json');
    expect(storyDocsStaticStorePath('button')).toBe('core/story-docs/button.json');
    expect(storyDocsPayloadJsonPointer('button')).toBe('/components/button');
    expect(storyDocsManifestRef('button')).toBe(
      '../services/core/story-docs/button.json#/components/button'
    );
  });

  it('keeps writer, loader, and manifest refs in lockstep for non-ASCII ids', () => {
    // '😀' is the component id of the unicode template story
    // (code/core/template/stories/unicode.stories.ts) whose snapshots broke Windows unpacking.
    // The portable-name rules live in `shared/open-service/static-names.ts`; this asserts the
    // service's writer/loader path and its manifest `$ref` agree through that derivation.
    const storePath = storyDocsStaticStorePath('😀');
    const { staticPath } = storyDocsServiceDef.queries.storyDocs;
    if (!staticPath) {
      throw new Error('storyDocs query must declare staticPath');
    }

    // Writer and browser loader both resolve the on-disk name through the definition's
    // `staticPath` hook; the manifest `$ref` must name the same file.
    expect(
      resolveStaticPath(
        'core/story-docs',
        'storyDocs',
        { staticPath: staticPath as (input: unknown) => string },
        { id: '😀' }
      )
    ).toBe(storePath);
    expect(storyDocsManifestRef('😀')).toBe(`../services/${storePath}#/components/😀`);
  });
});
