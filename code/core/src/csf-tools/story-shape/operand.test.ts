import { describe, expect, it } from 'vitest';

import { type NodePath, types as t } from 'storybook/internal/babel';

import { babelParseFile } from '../CsfFile.ts';
import { isOperand } from './operand.ts';

const readsArg = (code: string, written?: string) => {
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
  return isOperand(read!.node, ancestors, written === undefined ? undefined : expression(written));
};

const expression = (code: string) => {
  const [statement] = babelParseFile({ code: `x = ${code}`, filename: 'x.ts' }).path.node.body;
  return ((statement as t.ExpressionStatement).expression as t.AssignmentExpression).right;
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

  it.each([
    '!args.f',
    'x = args.f || noop',
    'x = args.f ? a : b',
    'a + args.f',
    'typeof args.f',
    'await args.f',
    'x = args.f as Listener',
    'x = args.f satisfies Listener',
    'x = args.f!',
  ])('marks %s where the story writes the arg as code an operator takes apart', (code) => {
    expect(readsArg(code, '() => null')).toBe(true);
    expect(readsArg(code, 'a ? b : c')).toBe(true);
  });

  it.each(['f(args.f)', 'x = args.f', 'c ? args.f : b', 'const x = { a: args.f }'])(
    'leaves %s for any written code',
    (code) => {
      expect(readsArg(code, '() => null')).toBe(false);
    }
  );

  it.each(['5', '-1', '"a"', 'shout', 'icons.arrow', 'fn()', 'new Date()', '[1]', '(a || b)'])(
    'leaves an operator next to code no operator takes apart, as %s',
    (written) => {
      expect(readsArg('x = args.n + 1', written)).toBe(false);
      expect(readsArg('!args.n', written)).toBe(false);
    }
  );
});
