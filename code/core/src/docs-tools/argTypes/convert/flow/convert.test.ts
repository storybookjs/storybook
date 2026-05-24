import { describe, expect, it } from 'vitest';

import { convert } from './convert.ts';

describe('Flow convert', () => {
  describe('union', () => {
    it('converts a union of literals to an enum', () => {
      expect(
        convert({
          name: 'union',
          elements: [
            { name: 'literal', value: "'sm'" },
            { name: 'literal', value: "'md'" },
            { name: 'literal', value: "'lg'" },
          ],
        })
      ).toEqual({ name: 'enum', value: ['sm', 'md', 'lg'] });
    });

    it('converts an optional literal union (?type) to an enum by filtering void', () => {
      // Flow represents `?('sm' | 'md' | 'lg')` as a union containing void and null
      expect(
        convert({
          name: 'union',
          elements: [
            { name: 'literal', value: "'sm'" },
            { name: 'literal', value: "'md'" },
            { name: 'literal', value: "'lg'" },
            { name: 'void' },
            { name: 'null' },
          ],
        })
      ).toEqual({ name: 'enum', value: ['sm', 'md', 'lg'] });
    });

    it('falls back to union when elements are not all literals after filtering', () => {
      expect(
        convert({
          name: 'union',
          elements: [
            { name: 'literal', value: "'sm'" },
            { name: 'string' },
          ],
        })
      ).toMatchObject({ name: 'union' });
    });

    it('falls back to union when only void/null remain after filtering', () => {
      expect(
        convert({
          name: 'union',
          elements: [{ name: 'void' }, { name: 'null' }],
        })
      ).toMatchObject({ name: 'union' });
    });
  });
});
