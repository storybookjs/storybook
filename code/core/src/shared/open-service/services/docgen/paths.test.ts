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

  it('encodes non-ASCII component ids into ASCII-safe snapshot names', () => {
    expect(componentIdToStaticName('😀')).toBe('%F0%9F%98%80');
    expect(docgenQueryStaticPath('😀')).toBe('%F0%9F%98%80.json');
    expect(docgenStaticStorePath('😀')).toBe('core/docgen/%F0%9F%98%80.json');
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
    // `staticPath` hook; the manifest `$ref` must name the same encoded file.
    expect(resolveStaticPath('core/docgen', 'docgen', { staticPath }, { id: '😀' })).toBe(
      storePath
    );
    expect(docgenManifestRef('😀')).toBe(`../services/${storePath}#/components/😀`);
    expect(decodeURIComponent(docgenQueryStaticPath('😀'))).toBe('😀.json');
  });
});
