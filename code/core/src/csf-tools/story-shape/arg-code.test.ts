import { describe, expect, it } from 'vitest';

import { type ESTree, type ESTreeNode, parseExpression } from '../index.ts';
import { argCode } from './arg-code.ts';

const argsOf = (code: string): Record<string, ESTreeNode> => {
  const object = parseExpression(code) as ESTree.ObjectExpression;
  return Object.fromEntries(
    object.properties.map((property) => {
      const { key, value } = property as ESTree.ObjectProperty;
      return [(key as ESTree.IdentifierName).name, value];
    })
  );
};

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

  it('adds no parentheses the story does not write', () => {
    expect(argCode(argsOf(`{ a: MB * 5, b: (o) => o.name, c: on ? 1 : 2, d: new Foo }`))).toEqual({
      a: 'MB * 5',
      b: '(o) => o.name',
      c: 'on ? 1 : 2',
      d: 'new Foo',
    });
  });

  it('keeps the parentheses the story wrote', () => {
    expect(argCode(argsOf(`{ a: (MB * 5), b: <Icon />, c: (<>Hi</>), d: <>Hi</> }`))).toEqual({
      a: '(MB * 5)',
      b: '<Icon />',
      c: '(<>Hi</>)',
      d: '<>Hi</>',
    });
  });
});
