import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeProjectAnnotations } from './normalizeProjectAnnotations';

describe('normalizeProjectAnnotations', () => {
  describe('blah', () => {
    beforeEach(() => {
      const warnThatThrows = vi.mocked(console.warn).getMockImplementation();
      vi.mocked(console.warn).mockImplementation(() => {});
      return () => {
        vi.mocked(console.warn).mockImplementation(warnThatThrows!);
      };
    });
    it('normalizes globals to initialGlobals', () => {
      expect(
        normalizeProjectAnnotations({
          globals: { a: 'b' },
        })
      ).toMatchObject({
        initialGlobals: { a: 'b' },
      });
    });
  });
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
