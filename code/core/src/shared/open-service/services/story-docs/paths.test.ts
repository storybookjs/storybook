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
    const storePath = storyDocsStaticStorePath('😀');
    const { staticPath } = storyDocsServiceDef.queries.storyDocs;
    if (!staticPath) {
      throw new Error('storyDocs query must declare staticPath');
    }

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

  it('points the manifest ref of a component titled Constructor at its escaped state key', () => {
    expect(storyDocsManifestRef('constructor')).toBe(
      '../services/core/story-docs/constructor.json#/components/~0constructor'
    );
  });
});
