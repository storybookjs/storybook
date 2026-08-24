import { describe, expect, it } from 'vitest';

import { getSummaryItems } from './getSummaryItems.ts';

describe('getSummaryItems', () => {
  it.each([
    ['an empty summary', '', ['']],
    ['a simple union', 'string | number', ['string', 'number']],
    ['duplicate items', 'string | number | string', ['string', 'number']],
    [
      'arrays and tuples',
      'Array<number> | [number, number]',
      ['Array<number>', '[number, number]'],
    ],
    [
      'nested delimiters',
      '((a: string | SVGSVGElement) => void) | RefObject<SVGSVGElement | number> | [a|b] | {a|b}',
      [
        '((a: string | SVGSVGElement) => void)',
        'RefObject<SVGSVGElement | number>',
        '[a|b]',
        '{a|b}',
      ],
    ],
    ['quoted pipes', '"a | b" | \'c | d\'', ['"a | b"', "'c | d'"]],
    ['template literal pipes', '`a | b` | null', ['`a | b`', 'null']],
    ['an escaped pipe', 'a\\|b | c', ['a\\|b', 'c']],
    ['a logical OR', 'boolean || string | number', ['boolean || string', 'number']],
    [
      'a conditional type',
      'T extends Promise<infer U> ? U | null : never',
      ['T extends Promise<infer U> ? U | null : never'],
    ],
    [
      'a parenthesized conditional type union',
      '(T extends Promise<infer U> ? U | null : never) | undefined',
      ['(T extends Promise<infer U> ? U | null : never)', 'undefined'],
    ],
    ['a function return union', '() => string | number', ['() => string | number']],
    [
      'a parenthesized function union',
      '(() => string | number) | null',
      ['(() => string | number)', 'null'],
    ],
    ['mismatched delimiters', 'Array<number] | null', ['Array<number] | null']],
    ['an unclosed delimiter', 'Array<number | null', ['Array<number | null']],
    ['an unclosed quote', '"a | b | null', ['"a | b | null']],
  ])('handles %s', (name, summary, expected) => {
    expect(getSummaryItems(summary)).toEqual(expected);
  });
});
