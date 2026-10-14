import { describe, expect, it } from 'vitest';

import { babelParse, type types as t } from 'storybook/internal/babel';

import {
  type FillSnippetTemplate,
  asOperand,
  fillHoles,
  printValue,
} from '../../docs-tools/snippetTemplate.ts';
import { argCode, fillWithStoryArgs } from './arg-code.ts';

const argsOf = (code: string): Record<string, t.Node> => {
  const statement = babelParse(`(${code})`).program.body[0] as t.ExpressionStatement;
  const object = statement.expression as t.ObjectExpression;
  return Object.fromEntries(
    object.properties.map((property) => {
      const { key, value } = property as t.ObjectProperty;
      return [(key as t.Identifier).name, value];
    })
  );
};

const fill: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, [name = '']) => {
    const printed = printValue(args[name], name);
    return kind === 'operand' ? asOperand(printed) : printed;
  });

describe('argCode', () => {
  it('leaves out a plain string, number, boolean, null or undefined, which prints as its value', () => {
    expect(
      argCode(argsOf(`{ a: 'Go', b: 2, c: -1, d: true, e: null, f: undefined, g: 'x' as const }`))
    ).toEqual({});
  });

  it('keeps the code of any other arg as written', () => {
    expect(
      argCode(
        argsOf(`{
          a: shout,
          b: fn((o) => o.name),
          c: new Date('2024-01-01'),
          d: ['a', ...ITEMS],
          e: { size: SIZE },
          f: \`Hi \${name}\`,
          g: icons.arrow,
        }`)
      )
    ).toEqual({
      a: 'shout',
      b: 'fn((o) => o.name)',
      c: "new Date('2024-01-01')",
      d: "['a', ...ITEMS]",
      e: '{ size: SIZE }',
      f: '`Hi ${name}`',
      g: 'icons.arrow',
    });
  });

  it('wraps code that is not a simple value in parentheses', () => {
    expect(
      argCode(argsOf(`{ a: MB * 5, b: (o) => o.name, c: on ? 1 : 2, d: new Foo, e: !on }`))
    ).toEqual({
      a: '(MB * 5)',
      b: '((o) => o.name)',
      c: '(on ? 1 : 2)',
      d: '(new Foo)',
      e: '(!on)',
    });
  });
});

describe('fillWithStoryArgs', () => {
  it('fills the template with the code of each arg that has it and the value of any other', () => {
    expect(
      fillWithStoryArgs(
        'label(⟦value label⟧, ⟦operand max⟧.toFixed(0), ⟦operand count⟧ * 2)',
        argsOf(`{ label: 'Go', max: MB * 5, count: 1 + 2 }`),
        fill
      )
    ).toBe('label("Go", (MB * 5).toFixed(0), (1 + 2) * 2)');
  });
});
