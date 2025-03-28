import { describe, expect, it } from 'vitest';

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
