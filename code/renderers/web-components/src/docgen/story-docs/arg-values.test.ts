import { babelParseExpression } from 'storybook/internal/babel';

import { describe, expect, it } from 'vitest';

import { evaluateArgValue, type ArgValue } from './arg-values.ts';

describe('evaluateArgValue', () => {
  it.each<{ source: string; expected: ArgValue }>([
    { source: `'text'`, expected: { kind: 'value', value: 'text' } },
    { source: `1`, expected: { kind: 'value', value: 1 } },
    { source: `true`, expected: { kind: 'value', value: true } },
    { source: `null`, expected: { kind: 'value', value: null } },
    { source: `undefined`, expected: { kind: 'unset' } },
    { source: `void 0`, expected: { kind: 'unset' } },
    { source: '`hello`', expected: { kind: 'value', value: 'hello' } },
    { source: 'String.raw`hello\\n`', expected: { kind: 'value', value: 'hello\\n' } },
    { source: `-2`, expected: { kind: 'value', value: -2 } },
    { source: `+2`, expected: { kind: 'value', value: 2 } },
    { source: `[1, 'two']`, expected: { kind: 'value', value: [1, 'two'] } },
    {
      source: `({ a: 1, 'b-c': true })`,
      expected: { kind: 'value', value: { a: 1, 'b-c': true } },
    },
    { source: `() => 1`, expected: { kind: 'function' } },
    { source: `function () {}`, expected: { kind: 'function' } },
    { source: `name`, expected: { kind: 'unresolved', source: 'name' } },
    { source: `({ ...name })`, expected: { kind: 'unresolved', source: '{ ...name }' } },
    { source: '`hello ${name}`', expected: { kind: 'unresolved', source: '`hello ${name}`' } },
  ])('$source', ({ source, expected }) => {
    expect(evaluateArgValue(babelParseExpression(source))).toEqual(expected);
  });
});
