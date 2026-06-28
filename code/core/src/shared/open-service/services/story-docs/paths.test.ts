import { describe, expect, it } from 'vitest';

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
});
