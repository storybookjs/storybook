import { describe, expect, it } from 'vitest';

import { babelParse, types as t } from 'storybook/internal/babel';

import { classifyValue } from './classify-value.ts';

/** Parses an expression the way a CSF arg value appears in a story file. */
function expression(code: string): t.Node {
  const file = babelParse(`(${code})`);
  const statement = file.program.body[0];
  if (!t.isExpressionStatement(statement)) {
    throw new Error(`Not an expression: ${code}`);
  }
  return statement.expression;
}

describe('classifyValue', () => {
  it.each([
    // Literals carry no scope, so they can sit directly in a template expression.
    { code: `'hello'`, kind: 'inline' },
    { code: '42', kind: 'inline' },
    { code: '-1', kind: 'inline' },
    { code: 'true', kind: 'inline' },
    { code: 'false', kind: 'inline' },
    { code: 'null', kind: 'inline' },
    { code: '123n', kind: 'inline' },
    { code: `'value' as const`, kind: 'inline' },

    // Self-contained expressions: every binding they reference is a JavaScript global.
    { code: `{ theme: 'dark' }`, kind: 'hoist' },
    { code: `['a', 'b']`, kind: 'hoist' },
    { code: `{ nested: { deep: [1, 2] } }`, kind: 'hoist' },
    { code: `Symbol('fixture')`, kind: 'hoist' },
    { code: `BigInt('9007199254740993')`, kind: 'hoist' },
    { code: `new Date('2020-01-01')`, kind: 'hoist' },
    { code: 'new Map()', kind: 'hoist' },
    { code: '/ab+c/i', kind: 'hoist' },
    { code: 'Math.PI', kind: 'hoist' },
    { code: 'Number.MAX_SAFE_INTEGER', kind: 'hoist' },
    { code: '`plain template`', kind: 'hoist' },
    { code: '2 + 3', kind: 'hoist' },

    // Nothing to render, and the runtime source decorator drops these too.
    { code: 'undefined', kind: 'omit' },
    { code: `''`, kind: 'omit' },
    { code: '() => 1', kind: 'omit' },
    { code: 'function () { return 1 }', kind: 'omit' },

    // References a binding the snippet cannot declare.
    { code: 'SOME_CONST', kind: 'unrepresentable' },
    { code: 'Severity.Warning', kind: 'unrepresentable' },
    { code: 'Sizes.LARGE', kind: 'unrepresentable' },
    { code: 'makeItems(3)', kind: 'unrepresentable' },
    { code: 'new CustomThing()', kind: 'unrepresentable' },
    { code: `{ color: sharedColor }`, kind: 'unrepresentable' },
    { code: '[Sizes.LARGE]', kind: 'unrepresentable' },
    { code: `{ ...BASE_OPTIONS, tone: 'neutral' }`, kind: 'unrepresentable' },
    { code: `['a', ...rest]`, kind: 'unrepresentable' },
    { code: '`prefix ${SOME_CONST}`', kind: 'unrepresentable' },
    { code: 'Math.max(SOME_CONST, 1)', kind: 'unrepresentable' },
    { code: `{ nested: { deep: SOME_CONST } }`, kind: 'unrepresentable' },
    { code: `{ onClick() { return 1 } }`, kind: 'unrepresentable' },
    { code: `{ handler: () => SOME_CONST }`, kind: 'unrepresentable' },
    { code: 'shared as Options', kind: 'unrepresentable' },
  ])('classifies $code as $kind', ({ code, kind }) => {
    expect(classifyValue(expression(code)).kind).toBe(kind);
  });

  it('treats an unhandled expression shape as unrepresentable', () => {
    expect(classifyValue(expression('a ? b : c')).kind).toBe('unrepresentable');
  });
});
