import { describe, expect, it } from 'vitest';

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
});
