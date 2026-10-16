import { describe, expect, it } from 'vitest';

import { expressionFromSource } from 'storybook/internal/csf-tools';

import { argFieldValue, evaluateArgExpression } from './story-docs-args.ts';

describe('evaluateArgExpression', () => {
  it('strips comments from an unevaluable arg, which Angular templates cannot parse', () => {
    expect(evaluateArgExpression(expressionFromSource(`helper(/* note */ 'x')`), [])).toBe(
      `helper('x')`
    );
    expect(
      evaluateArgExpression(
        expressionFromSource(`helper(\n      'x', // trailing\n      2,\n    )`),
        []
      )
    ).toBe(`helper(\n  'x',\n  2,\n)`);
  });
});

describe('argFieldValue', () => {
  it('keeps comments and dedents continuation lines, but not template literal values', () => {
    expect(argFieldValue(expressionFromSource(`(value) => /* why */ value.trim()`))).toBe(
      `(value) => /* why */ value.trim()`
    );
    expect(argFieldValue(expressionFromSource('helper({\n      code: `a\n  b`,\n    })'))).toBe(
      'helper({\n  code: `a\n  b`,\n})'
    );
  });
});
