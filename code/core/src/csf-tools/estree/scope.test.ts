import { describe, expect, it } from 'vitest';

import { type E, parseModule } from './ast.ts';
import { analyzeScopes, generateUid } from './scope.ts';

const programBindings = (code: string) => {
  const { program } = parseModule(code, 'file.tsx');
  return Object.fromEntries(
    [...analyzeScopes(program).program.bindings].map(([name, binding]) => [
      name,
      { constant: binding.constant, references: binding.references.length },
    ])
  );
};

describe('analyzeScopes', () => {
  it.each([
    ['a const read once', 'const a = 1; a;', { a: { constant: true, references: 1 } }],
    ['a reassigned let', 'let a = 1; a = 2;', { a: { constant: false, references: 0 } }],
    [
      'an update, which reads and writes',
      'let a = 1; a++;',
      { a: { constant: false, references: 1 } },
    ],
    ['an exported const', 'export const a = 1;', { a: { constant: true, references: 1 } }],
    [
      'a value exported next to a same-named type',
      'export const Tag = {}; export type Tag = string;',
      { Tag: { constant: true, references: 2 } },
    ],
    ['a redeclared var', 'var a = 1; var a = 2;', { a: { constant: false, references: 0 } }],
    [
      'a component used in JSX',
      'import { B } from "b"; <B />;',
      { B: { constant: true, references: 1 } },
    ],
    ['an intrinsic JSX tag', 'const div = 1; <div />;', { div: { constant: true, references: 0 } }],
    [
      'a JSX member object',
      'const w = {}; <w.render />;',
      { w: { constant: true, references: 1 } },
    ],
    [
      '`import.meta`',
      'const meta = {}; import.meta.env;',
      { meta: { constant: true, references: 0 } },
    ],
    [
      'a shadowing parameter',
      'const tags = []; const f = (tags) => tags;',
      { tags: { constant: true, references: 0 }, f: { constant: true, references: 0 } },
    ],
  ])('counts %s', (_, code, expected) => {
    expect(programBindings(code)).toEqual(expected);
  });

  it.each([
    ['`typeof` in a type alias', 'const meta = {}; type S = StoryObj<typeof meta>;', 1],
    ['`satisfies`', 'import { Meta } from "x"; const m = {} satisfies Meta;', 1],
    ['`as`', 'import { Meta } from "x"; const m = {} as Meta<{}>;', 1],
    ['call type arguments', 'import { T } from "x"; f<T>();', 1],
    ['`implements`', 'import { I } from "x"; class C implements I {}', 1],
    ['a `: Type` annotation', 'import { T } from "x"; let a: T;', 0],
    ['a parameter annotation', 'import { T } from "x"; function f(a: T) {}', 0],
    ['a method signature name', 'const get = 1; interface I { get(): void }', 1],
    ['a computed type key', 'const K = Symbol(); type X = { [K]: true };', 1],
  ])('counts type references like Babel: %s', (_, code, references) => {
    const [first] = Object.values(programBindings(code));
    expect(first.references).toBe(references);
  });

  it('counts overload signatures as references to the implementation', () => {
    expect(programBindings('function f(): void; function f(a?: unknown) {} f();')).toEqual({
      f: { constant: true, references: 2 },
    });
  });

  it('treats a function declared in a loop body as non-constant', () => {
    const { program } = parseModule('for (const x of y) { function f() {} f(); }', 'file.ts');
    const info = analyzeScopes(program);
    const loop = program.body[0] as E.ForOfStatement;
    const statement = (loop.body as E.BlockStatement).body[1] as E.ExpressionStatement;
    const call = (statement.expression as E.CallExpression).callee;
    expect(info.bindingOf(call)).toMatchObject({ name: 'f', constant: false });
  });

  it('does not bind TS enums or `declare global` vars at the top level', () => {
    expect(programBindings('enum E { A } declare global { var X: number }')).toEqual({});
  });

  it('generates Babel-style unique names', () => {
    const info = analyzeScopes(parseModule('const _meta = 1; const _meta2 = 2;').program);
    expect(generateUid(info, 'meta')).toBe('_meta3');
    expect(generateUid(info, 'meta')).toBe('_meta4');
  });
});
