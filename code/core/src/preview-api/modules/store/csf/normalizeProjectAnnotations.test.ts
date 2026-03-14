import { describe, expect, it } from 'vite-plus/test';

import { normalizeProjectAnnotations } from './normalizeProjectAnnotations';

describe('normalizeProjectAnnotations', () => {
  it('passes through initialGlobals', () => {
    expect(
      normalizeProjectAnnotations({
        initialGlobals: { a: 'b' },
      })
    ).toMatchObject({
      initialGlobals: { a: 'b' },
    });
  });
});
