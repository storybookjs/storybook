import { describe, expect, it } from 'vitest';

import { splitSummary } from './split-summary.ts';

describe('splitSummary', () => {
  it.each([
    ['', ['']],
    ['string | number', ['string', 'number']],
    ['Array<number> | [number, number]', ['Array<number>', '[number, number]']],
    ['Array<string | number> | null', ['Array<string | number>', 'null']],
    ['[string | number, boolean] | null', ['[string | number, boolean]', 'null']],
    ['{ value: string | number } | null', ['{ value: string | number }', 'null']],
    ['((value: string | number) => void) | null', ['((value: string | number) => void)', 'null']],
    [
      'Map<string, Array<number | null>> | undefined',
      ['Map<string, Array<number | null>>', 'undefined'],
    ],
    ['"a|b" | \'c|d\'', ['"a|b"', "'c|d'"]],
    ['"a\\\"|b" | null', ['"a\\\"|b"', 'null']],
    ['string | string', ['string', 'string']],
  ])('splits only outer unions in %s', (summary, expected) => {
    expect(splitSummary(summary)).toEqual(expected);
  });

  it.each([
    'string | Array<number',
    'string | [number}',
    'string | "unterminated',
    'string | number>',
    '() => string | number',
    '`a|b` | null',
  ])('preserves ambiguous or malformed summary %s', (summary) => {
    expect(splitSummary(summary)).toEqual([summary]);
  });
});
