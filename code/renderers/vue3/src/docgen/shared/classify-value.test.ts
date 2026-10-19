import { describe, expect, it } from 'vitest';

import { babelParse, types as t } from 'storybook/internal/babel';

import { classifyValue, isSelfContainedFunction, type ValuePlan } from './classify-value.ts';

describe('classifyValue', () => {
  it.each<[input: string, output: ValuePlan['kind']]>([
    [`'hello'`, 'inline'],
    ['42', 'inline'],
    ['-1', 'inline'],
    ['true', 'inline'],
    ['false', 'inline'],
    ['null', 'inline'],
    ['123n', 'inline'],
    [`'value' as const`, 'inline'],

    [`{ theme: 'dark' }`, 'hoist'],
    [`['a', 'b']`, 'hoist'],
    [`{ nested: { deep: [1, 2] } }`, 'hoist'],
    [`Symbol('fixture')`, 'hoist'],
    [`BigInt('9007199254740993')`, 'hoist'],
    [`new Date('2020-01-01')`, 'hoist'],
    ['new Map()', 'hoist'],
    ['/ab+c/i', 'hoist'],
    ['Math.PI', 'hoist'],
    ['Number.MAX_SAFE_INTEGER', 'hoist'],
    ['`plain template`', 'hoist'],
    ['2 + 3', 'hoist'],

    ['undefined', 'unset'],
    [`''`, 'omit'],
    ['() => 1', 'omit'],
    ['function () { return 1 }', 'omit'],

    ['SOME_CONST', 'unrepresentable'],
    ['Severity.Warning', 'unrepresentable'],
    ['Sizes.LARGE', 'unrepresentable'],
    ['makeItems(3)', 'unrepresentable'],
    ['new CustomThing()', 'unrepresentable'],
    [`{ color: sharedColor }`, 'unrepresentable'],
    ['[Sizes.LARGE]', 'unrepresentable'],
    [`{ ...BASE_OPTIONS, tone: 'neutral' }`, 'unrepresentable'],
    [`['a', ...rest]`, 'unrepresentable'],
    ['`prefix ${SOME_CONST}`', 'unrepresentable'],
    ['Math.max(SOME_CONST, 1)', 'unrepresentable'],
    [`{ nested: { deep: SOME_CONST } }`, 'unrepresentable'],
    [`{ onClick() { return 1 } }`, 'unrepresentable'],
    [`{ handler: () => SOME_CONST }`, 'unrepresentable'],
    ['shared as Options', 'unrepresentable'],
  ])('%s -> %s', (input, output) => {
    expect(classifyValue(expression(input)).kind).toBe(output);
  });

  it('a ? b : c -> unrepresentable', () => {
    expect(classifyValue(expression('a ? b : c')).kind).toBe('unrepresentable');
  });
});

describe('isSelfContainedFunction', () => {
  it.each<[input: string, output: boolean]>([
    ['() => 1', true],
    ['(value) => value.toUpperCase()', true],
    ['(payload) => console.log(payload)', true],
    ['({ value }) => value', true],
    ['(a, ...rest) => rest.concat(a)', true],
    [`(mode = 'auto') => mode`, true],
    ['() => { const x = 1; return x + 1; }', true],
    ['function (n) { return Math.max(n, 0); }', true],

    ['(value) => formatHelper(value)', false],
    ['() => SOME_CONST', false],
    [`(value = DEFAULT_MODE) => value`, false],
    ['() => { emit(1); }', false],
    ['() => { const x = SOME_CONST; return x; }', false],
    ['(value) => ({ ...BASE, value })', false],

    [`'text'`, false],
    ['makeHandler()', false],
  ])('%s -> %s', (input, output) => {
    expect(isSelfContainedFunction(expression(input))).toBe(output);
  });
});

function expression(code: string): t.Node {
  const file = babelParse(`(${code})`);
  const statement = file.program.body[0];
  if (!t.isExpressionStatement(statement)) {
    throw new Error(`Not an expression: ${code}`);
  }
  return statement.expression;
}
