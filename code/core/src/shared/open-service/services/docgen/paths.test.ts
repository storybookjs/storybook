import { describe, expect, it } from 'vitest';

import { resolveStaticPath } from '../../service-runtime.ts';
import { docgenServiceDef } from './definition.ts';
import {
  docgenManifestRef,
  docgenPayloadJsonPointer,
  docgenQueryStaticPath,
  docgenStaticStorePath,
} from './paths.ts';

describe('docgen paths', () => {
  it('keeps manifest refs aligned with docgen staticPath output', () => {
    expect(docgenQueryStaticPath('button')).toBe('button.json');
    expect(docgenStaticStorePath('button')).toBe('core/docgen/button.json');
    expect(docgenPayloadJsonPointer('button')).toBe('/components/button');
    expect(docgenManifestRef('button')).toBe(
      '../services/core/docgen/button.json#/components/button'
    );
  });

  it('keeps writer, loader, and manifest refs in lockstep for non-ASCII ids', () => {
    // '😀' is the component id of the unicode template story
    // (code/core/template/stories/unicode.stories.ts) whose snapshots broke Windows unpacking.
    // The portable-name rules live in `shared/open-service/static-names.ts`; this asserts the
    // service's writer/loader path and its manifest `$ref` agree through that derivation.
    const storePath = docgenStaticStorePath('😀');
    const { staticPath } = docgenServiceDef.queries.docgen;
    if (!staticPath) {
      throw new Error('docgen query must declare staticPath');
    }

    // Writer and browser loader both resolve the on-disk name through the definition's
    // `staticPath` hook; the manifest `$ref` must name the same file.
    expect(
      resolveStaticPath(
        'core/docgen',
        'docgen',
        { staticPath: staticPath as (input: unknown) => string },
        { id: '😀' }
      )
    ).toBe(storePath);
    expect(docgenManifestRef('😀')).toBe(`../services/${storePath}#/components/😀`);
  });
});
