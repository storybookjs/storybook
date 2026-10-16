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

  it('keeps trailing whitespace inside a template literal', () => {
    expect(evaluateArgExpression(expressionFromSource('helper(`a  \nb`)'), [])).toBe(
      'helper(`a  \nb`)'
    );
  });

  it('drops the whitespace before a trailing comment in a CRLF file', () => {
    expect(
      evaluateArgExpression(
        expressionFromSource(`helper(\r\n      'x', // trailing\r\n      2,\r\n    )`),
        []
      )
    ).toBe(`helper(\n  'x',\n  2,\n)`);
  });

  it('keeps the tokens around a removed comment apart', () => {
    expect(evaluateArgExpression(expressionFromSource('a/* c */instanceof B'), [])).toBe(
      'a instanceof B'
    );
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
    expect(
      argFieldValue(
        expressionFromSource(
          'helper({\n\t\tcode: `a\n\tb`,\n\t\tfn() {\n\t\t\treturn 1;\n\t\t},\n\t})'
        )
      )
    ).toBe('helper({\n  code: `a\n\tb`,\n  fn() {\n    return 1;\n  },\n})');
  });
});
