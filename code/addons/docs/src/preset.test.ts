import { describe, expect, it } from 'vitest';

import { docs } from './preset.ts';

describe('docs preset', () => {
  it('returns an object when autodocs is disabled for a test build', () => {
    const result = docs({ defaultName: 'Docs' }, {
      build: { test: { disableAutoDocs: true } },
    } as Parameters<typeof docs>[1]);

    expect(result).toEqual({});
  });
});
