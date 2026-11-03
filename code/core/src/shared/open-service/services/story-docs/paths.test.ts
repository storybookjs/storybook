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

  it('encodes non-ASCII component ids into ASCII-safe snapshot names', () => {
    expect(componentIdToStaticName('😀')).toBe('%F0%9F%98%80');
    expect(storyDocsQueryStaticPath('😀')).toBe('%F0%9F%98%80.json');
    expect(storyDocsStaticStorePath('😀')).toBe('core/story-docs/%F0%9F%98%80.json');
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
    // `staticPath` hook; the manifest `$ref` must name the same encoded file.
    expect(resolveStaticPath('core/story-docs', 'storyDocs', { staticPath }, { id: '😀' })).toBe(
      storePath
    );
    expect(storyDocsManifestRef('😀')).toBe(`../services/${storePath}#/components/😀`);
    expect(decodeURIComponent(storyDocsQueryStaticPath('😀'))).toBe('😀.json');
  });
});
