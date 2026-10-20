import { visitorKeys } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { type E, type Node, parseModule, walk } from './ast.ts';
import { TS_EXPRESSIONS, TS_TYPES, analyzeScopes, generateUid } from './scope.ts';

const identifiersNamed = (program: E.Program, name: string) => {
  const found: Node[] = [];
  walk(program, (node) => {
    if (node.type === 'Identifier' && node.name === name) {
      found.push(node);
    }
  });
  return found;
};

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
    [
      'a reassigned let, whose write is a use',
      'let a = 1; a = 2;',
      { a: { constant: false, references: 1 } },
    ],
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
    ['a same-named type alias', 'const T = 1; type T = string;', 1],
    [
      'a namespace merged into a function',
      'function F() {} namespace F { export const a = 1; }',
      1,
    ],
    ['an ambient signature in a block', 'function f() {} { declare function f(): void; }', 1],
    [
      'an enum that shadows an import',
      'import { Color } from "x"; function f() { enum Color { A } return Color.A; }',
      2,
    ],
  ])('counts type references like Babel: %s', (_, code, references) => {
    const [first] = Object.values(programBindings(code));
    expect(first.references).toBe(references);
  });

  it('resolves parameter defaults outside the function body', () => {
    expect(
      programBindings('const q = 1; function f(a = q) { const q = 2; return a; }')
    ).toMatchObject({ q: { references: 1 } });
  });

  it('resolves the switch discriminant outside the switch scope', () => {
    expect(
      programBindings('const x = 1; switch (x) { case 1: { const x = 2; x; } }')
    ).toMatchObject({ x: { references: 1 } });
  });

  it('visits decorators on parameters and abstract members', () => {
    expect(programBindings('const dec = () => {}; class A { m(@dec p: string) {} }')).toMatchObject(
      { dec: { references: 1 } }
    );
    expect(
      programBindings('const dec = () => {}; abstract class A { @dec abstract p: string; }')
    ).toMatchObject({ dec: { references: 1 } });
  });

  it('counts the namespace an import-equals declaration reads', () => {
    expect(programBindings("import NS from 'x'; import Y = NS.Y; Y;")).toMatchObject({
      NS: { references: 1 },
    });
  });

  it('binds a var declared in a class static block to the block', () => {
    const { program } = parseModule('class A { static { var v = 1; v; } }', 'file.ts');
    const info = analyzeScopes(program);
    expect(info.program.bindings.has('v')).toBe(false);
    expect(info.unbound.has('v')).toBe(false);
  });

  it('keeps a binding alive through a write inside a function', () => {
    expect(
      programBindings('let token; export function setSession(s) { token = s.token; }')
    ).toMatchObject({ token: { constant: false, references: 1 } });
  });

  it('refuses TS node types it does not know instead of treating them as types', () => {
    const program = {
      type: 'Program',
      body: [{ type: 'ExpressionStatement', expression: { type: 'TSNewThing' } }],
    } as unknown as E.Program;
    expect(() => analyzeScopes(program)).toThrow('TSNewThing');
  });

  it('classifies every TS node type of the oxc parser it runs on', () => {
    const unclassified = Object.keys(visitorKeys).filter(
      (type) => type.startsWith('TS') && !TS_EXPRESSIONS.has(type) && !TS_TYPES.has(type)
    );
    // `parseModule` replaces a parenthesized type with the type inside it.
    expect(unclassified).toEqual(['TSParenthesizedType']);
  });

  it.each([
    ['a type alias', 'type T = typeof x;', (statement: any) => statement.typeAnnotation],
    [
      'an annotation',
      'let a: typeof x;',
      (statement: any) => statement.declarations[0].id.typeAnnotation.typeAnnotation,
    ],
    [
      'a type argument',
      'f<typeof x>();',
      (statement: any) => statement.expression.typeArguments.params[0],
    ],
  ])('refuses a TS node type it does not know inside %s', (_where, code, typeNode) => {
    const { program } = parseModule(`const x = 1; ${code}`, 'file.ts');
    typeNode(program.body[1]).type = 'TSFutureRuntimeNode';
    expect(() => analyzeScopes(program)).toThrow('TSFutureRuntimeNode');
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

  it.each([
    'function f(a) { if (a) { var a = 1; } return a; }',
    'const f = (a) => { if (a) { var a = 1; } return a; };',
    'const o = { m(a) { if (a) { var a = 1; } return a; } };',
  ])('keeps one binding for a body `var` that redeclares a parameter: %s', (code) => {
    const { program } = parseModule(code, 'file.ts');
    const info = analyzeScopes(program);
    const [param, test, declared, returned] = identifiersNamed(program, 'a');
    const binding = info.bindingOf(param);
    expect(info.bindingOf(declared)).toBe(binding);
    expect(binding).toMatchObject({ kind: 'param', constant: false, references: [test, returned] });
  });

  it.each(['(a) => (a) => a', '(a) => class a {}', '(a) => function a() { return a; }'])(
    'keeps a parameter apart from the function or class an arrow returns: %s',
    (code) => {
      const { program } = parseModule(code, 'file.ts');
      const info = analyzeScopes(program);
      const [outer, inner] = identifiersNamed(program, 'a');
      expect(info.bindingOf(outer)).toMatchObject({ constant: true, references: [] });
      expect(info.bindingOf(inner)).not.toBe(info.bindingOf(outer));
    }
  );

  it('counts exports and overloads inside a namespace like Babel', () => {
    const { program } = parseModule(
      'namespace N { export function f(): void; export function f(a?: number) {} f(); }',
      'file.ts'
    );
    const block = (program.body[0] as E.TSModuleDeclaration).body as E.TSModuleBlock;
    const implementation = block.body[1] as E.ExportNamedDeclaration;
    const id = (implementation.declaration as E.Function).id!;
    expect(analyzeScopes(program).bindingOf(id)?.references).toHaveLength(3);
  });

  it('does not bind TS enums or `declare global` vars at the top level', () => {
    expect(programBindings('enum E { A } declare global { var X: number }')).toEqual({});
  });

  it.each([
    'enum _meta { A }',
    'namespace _meta { export const x = 1; }',
    'namespace _meta.inner { export const x = 1; }',
    'declare function _meta(): void;',
  ])('generates a name that does not collide with %s', (code) => {
    const info = analyzeScopes(parseModule(code, 'file.ts').program);
    expect(generateUid(info, 'meta')).toBe('_meta2');
  });

  it('counts export statements and top-level overload signatures as references', () => {
    const code = [
      'export const a = 1;',
      'type T = typeof a;',
      'function f(x: string): void;',
      'function f(x) {}',
      'export function h(x: string): void;',
      'export function h(x) {}',
      'export default function g() {}',
      'const X = 1;',
      'export type X = number;',
    ].join('\n');
    const { bindings } = analyzeScopes(parseModule(code, 'file.ts').program).program;
    const types = (name: string) => bindings.get(name)!.references.map((node) => node.type);
    expect(types('a')).toEqual(['Identifier', 'ExportNamedDeclaration']);
    expect(types('f')).toEqual(['TSDeclareFunction']);
    expect(types('h')).toEqual(['ExportNamedDeclaration', 'ExportNamedDeclaration']);
    expect(types('X')).toEqual(['ExportNamedDeclaration']);
    expect(types('g')).toEqual(['ExportDefaultDeclaration']);
  });

  it('lists the top-level names of TypeScript declarations', () => {
    const code = [
      'type Story = {};',
      'export interface Props {}',
      'export default interface Default {}',
      'export declare enum Size { S }',
      'namespace NS.inner {}',
      'declare function ambient(): void;',
      'function overloaded(a: string): void;',
      'function overloaded(a) {}',
      'declare const value: number;',
      "declare module 'virtual' {}",
      'declare global { interface Window {} }',
      'function f() { type Local = 1; }',
    ].join('\n');
    const info = analyzeScopes(parseModule(code, 'file.ts').program);
    expect([...info.tsDeclarationNames]).toEqual([
      'Story',
      'Props',
      'Default',
      'Size',
      'NS',
      'ambient',
      'overloaded',
    ]);
    expect([...info.program.bindings.keys()]).toEqual(['overloaded', 'value', 'f']);
  });

  it('generates Babel-style unique names', () => {
    const info = analyzeScopes(parseModule('const _meta = 1; const _meta2 = 2;').program);
    expect(generateUid(info, 'meta')).toBe('_meta3');
    expect(generateUid(info, 'meta')).toBe('_meta4');
  });
});
