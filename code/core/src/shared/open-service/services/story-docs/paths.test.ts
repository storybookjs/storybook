import { describe, expect, it } from 'vitest';

import { resolveStaticPath } from '../../service-runtime.ts';
import { componentIdToStaticName } from '../shared/paths.ts';
import { storyDocsServiceDef } from './definition.ts';
import {
  storyDocsManifestRef,
  storyDocsQueryStaticPath,
  storyDocsStaticStorePath,
} from './paths.ts';

describe('story-docs paths', () => {
  it('keeps manifest refs aligned with storyDocs staticPath output', () => {
    expect(storyDocsQueryStaticPath('button')).toBe('button.json');
    expect(storyDocsStaticStorePath('button')).toBe('core/story-docs/button.json');
    expect(storyDocsManifestRef('button')).toBe(
      '../services/core/story-docs/button.json#/components/button'
    );
  });

  it('maps non-ASCII component ids to portable snapshot names', () => {
    // '😀' is the component id of the unicode template story
    // (code/core/template/stories/unicode.stories.ts) whose raw-emoji snapshots broke
    // Windows unpacking.
    expect(componentIdToStaticName('😀')).toMatch(/^id-[0-9a-f]{16}$/);
    expect(storyDocsQueryStaticPath('😀')).toMatch(/^id-[0-9a-f]{16}\.json$/);
    expect(storyDocsStaticStorePath('😀')).toMatch(/^core\/story-docs\/id-[0-9a-f]{16}\.json$/);
  });

  it('keeps writer, loader, and manifest refs in lockstep for non-ASCII ids', () => {
    // '😀' is the component id of the unicode template story
    // (code/core/template/stories/unicode.stories.ts) whose snapshots broke Windows unpacking.
    const storePath = storyDocsStaticStorePath('😀');
    const { staticPath } = storyDocsServiceDef.queries.storyDocs;
    if (!staticPath) {
      throw new Error('storyDocs query must declare staticPath');
    }

    // Writer and browser loader both resolve the on-disk name through the definition's
    // `staticPath` hook; the manifest `$ref` must name the same file.
    expect(resolveStaticPath('core/story-docs', 'storyDocs', { staticPath }, { id: '😀' })).toBe(
      storePath
    );
    expect(storyDocsManifestRef('😀')).toBe(`../services/${storePath}#/components/😀`);
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
  });
});
