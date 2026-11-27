import { describe, expect, it } from 'vitest';

import { type ESTree as E, parseExpression } from 'storybook/internal/csf-tools';

import { argFieldValue, evaluateArgExpression } from './story-docs-args.ts';

const argOnLineIndentedBy = (indent: string, source: string) => {
  const args = parseExpression(`{\n${indent}value: ${source},\n}`) as E.ObjectExpression;
  return (args.properties[0] as E.ObjectProperty).value;
};

describe('evaluateArgExpression', () => {
  it('strips comments from an unevaluable arg, which Angular templates cannot parse', () => {
    expect(evaluateArgExpression(parseExpression(`helper(/* note */ 'x')`), [])).toBe(
      `helper('x')`
    );
    expect(
      evaluateArgExpression(
        argOnLineIndentedBy('    ', `helper(\n      'x', // trailing\n      2,\n    )`),
        []
      )
    ).toBe(`helper(\n  'x',\n  2,\n)`);
  });

  it('keeps trailing whitespace inside a template literal', () => {
    expect(evaluateArgExpression(parseExpression('helper(`a  \nb`)'), [])).toBe('helper(`a  \nb`)');
  });

  it('drops the whitespace before a trailing comment in a CRLF file', () => {
    expect(
      evaluateArgExpression(
        argOnLineIndentedBy('    ', `helper(\r\n      'x', // trailing\r\n      2,\r\n    )`),
        []
      )
    ).toBe(`helper(\n  'x',\n  2,\n)`);
  });

  it('keeps the tokens around a removed comment apart', () => {
    expect(evaluateArgExpression(parseExpression('a/* c */instanceof B'), [])).toBe(
      'a instanceof B'
    );
  });
});

describe('argFieldValue', () => {
  it('keeps comments and dedents continuation lines, but not template literal values', () => {
    expect(argFieldValue(parseExpression(`(value) => /* why */ value.trim()`))).toBe(
      `(value) => /* why */ value.trim()`
    );
    expect(
      argFieldValue(argOnLineIndentedBy('    ', 'helper({\n      code: `a\n  b`,\n    })'))
    ).toBe('helper({\n  code: `a\n  b`,\n})');
    expect(
      argFieldValue(
        argOnLineIndentedBy(
          '\t',
          'helper({\n\t\tcode: `a\n\tb`,\n\t\tfn() {\n\t\t\treturn 1;\n\t\t},\n\t})'
        )
      )
    ).toBe('helper({\n  code: `a\n\tb`,\n  fn() {\n    return 1;\n  },\n})');
  });

  it('dedents a value that does not end on a bracket by the indent of its first line', () => {
    expect(argFieldValue(argOnLineIndentedBy('    ', '(value) =>\n      value.trim()'))).toBe(
      '(value) =>\n  value.trim()'
    );
  });
});
