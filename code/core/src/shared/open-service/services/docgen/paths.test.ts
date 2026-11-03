import { describe, expect, it } from 'vitest';

import { resolveStaticPath } from '../../service-runtime.ts';
import { componentIdToStaticName } from '../shared/paths.ts';
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

  it('leaves plain ASCII component ids unchanged', () => {
    expect(componentIdToStaticName('addons-docs-codepanel')).toBe('addons-docs-codepanel');
  });

  it('maps non-ASCII component ids to portable snapshot names', () => {
    // '😀' is the component id of the unicode template story
    // (code/core/template/stories/unicode.stories.ts) whose raw-emoji snapshots broke
    // Windows unpacking.
    expect(componentIdToStaticName('😀')).toMatch(/^id-[0-9a-f]{16}$/);
    expect(docgenQueryStaticPath('😀')).toMatch(/^id-[0-9a-f]{16}\.json$/);
    expect(docgenStaticStorePath('😀')).toMatch(/^core\/docgen\/id-[0-9a-f]{16}\.json$/);
  });

  it('keeps writer, loader, and manifest refs in lockstep for non-ASCII ids', () => {
    // '😀' is the component id of the unicode template story
    // (code/core/template/stories/unicode.stories.ts) whose snapshots broke Windows unpacking.
    const storePath = docgenStaticStorePath('😀');
    const { staticPath } = docgenServiceDef.queries.docgen;
    if (!staticPath) {
      throw new Error('docgen query must declare staticPath');
    }

    // Writer and browser loader both resolve the on-disk name through the definition's
    // `staticPath` hook; the manifest `$ref` must name the same file.
    expect(resolveStaticPath('core/docgen', 'docgen', { staticPath }, { id: '😀' })).toBe(
      storePath
    );
    expect(docgenManifestRef('😀')).toBe(`../services/${storePath}#/components/😀`);
  });

  it('derives snapshot names that survive URL decoding and filesystem limits', () => {
    for (const id of ['button', '😀', 'Кнопки', 'a b', '界'.repeat(30)]) {
      const name = componentIdToStaticName(id);

      // Static hosts percent-decode request paths before their filesystem lookup, so a
      // literal `%` on disk would be unreachable through any fetch.
      expect(decodeURIComponent(name)).toBe(name);
      // Printable ASCII keeps the name extractable on every platform's tar tooling.
      expect(name).toMatch(/^[A-Za-z0-9._!~*'()-]+$/);
      // `.json` must still fit under the 255-byte per-component filename limit.
      expect(name.length).toBeLessThanOrEqual(250);
    }

    // Digest names are deterministic and distinct per id.
    expect(componentIdToStaticName('界'.repeat(30))).toBe(componentIdToStaticName('界'.repeat(30)));
    expect(componentIdToStaticName('界'.repeat(30))).not.toBe(
      componentIdToStaticName('界'.repeat(31))
    );
  });
});
