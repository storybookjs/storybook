import { describe, expect, it } from 'vitest';

import { type NodePath, types as t } from 'storybook/internal/babel';

import { babelParseFile } from '../CsfFile.ts';
import { isOperand } from './operand.ts';

const readsArg = (code: string) => {
  let read: NodePath<t.MemberExpression> | undefined;
  babelParseFile({ code, filename: 'x.ts' }).path.traverse({
    MemberExpression(path) {
      if (t.isIdentifier(path.node.object, { name: 'args' })) {
        read ??= path;
      }
    },
  });
  const ancestors = read!
    .getAncestry()
    .slice(1)
    .map((path) => path.node);
  return isOperand(read!.node, ancestors);
};

describe('isOperand', () => {
  it.each([
    'a - args.n',
    'a-args.n',
    '-args.n',
    'args.n ** 2',
    'args.n.toFixed()',
    'args.f()',
    'const f = () => args.o',
    'args.o;',
  ])('marks %s, where a literal could read differently', (code) => {
    expect(readsArg(code)).toBe(true);
  });

  it.each([
    'x = args.n - a',
    'x = args.n + a',
    'a + args.n',
    '+args.n',
    '2 ** args.n',
    '!args.n',
    '~args.n',
    'typeof args.n',
    'f(args.n)',
    'const x = { a: args.n }',
  ])('leaves %s, where any literal reads the same', (code) => {
    expect(readsArg(code)).toBe(false);
  });
});
