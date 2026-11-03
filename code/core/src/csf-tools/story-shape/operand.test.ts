import { describe, expect, it } from 'vitest';

import { type ESTree, type ESTreeNode, parseModule, walk } from '../index.ts';
import { isOperand } from './operand.ts';

const readsArg = (code: string, written?: string) => {
  let read: ESTree.MemberExpression | undefined;
  const parents = new Map<ESTreeNode, ESTreeNode | null>();
  walk(parseModule(code, 'x.ts').program, (node, parent) => {
    parents.set(node, parent);
    if (
      !read &&
      node.type === 'MemberExpression' &&
      node.object.type === 'Identifier' &&
      node.object.name === 'args'
    ) {
      read = node;
    }
  });
  const ancestors: ESTreeNode[] = [];
  for (let parent = parents.get(read!); parent; parent = parents.get(parent)) {
    ancestors.push(parent);
  }
  return isOperand(read!, ancestors, written === undefined ? undefined : expression(written));
};

// Parsed in a module, as `parseExpression` does not keep the parentheses around a whole fragment.
const expression = (code: string) => {
  const [statement] = parseModule(`x = ${code}`, 'x.ts').program.body;
  return ((statement as ESTree.ExpressionStatement).expression as ESTree.AssignmentExpression)
    .right;
};

describe('isOperand', () => {
  it.each([
    '-args?.n',
    'a - args?.n',
    '(args?.n).toFixed()',
    'a - args.n',
    'a-args.n',
    '-args.n',
    'args.n ** 2',
    'args.n.toFixed()',
    'args.f()',
    'new args.C()',
    'class X extends args.Base {}',
    'x = class extends args.Base {}',
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
    'x = args?.f || noop',
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
