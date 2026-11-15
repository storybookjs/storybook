import { inspect } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  type E,
  codeFrame,
  isIdentifier,
  locationOf,
  moduleOf,
  objectProperty,
  parseExpression,
  outerSpan,
  parseModule,
  placeableTextOf,
  textOf,
  walk,
} from './ast.ts';

describe('parseModule', () => {
  const flowBody = 'const x: { +readOnly: number } = {};';

  it.each([
    ['// @flow', `// @flow\n${flowBody}`],
    ['/* @flow */', `/* @flow */\n${flowBody}`],
    ['/** @flow */', `/** @flow */\n${flowBody}`],
    ['/* @flow strict */', `/* @flow strict */\n${flowBody}`],
    ['a multi-line docblock', `/**\n * Button stories.\n *\n * @flow\n */\n${flowBody}`],
    [
      '// @flow after a license comment',
      `/*\n * Copyright (c) Example Inc.\n * MIT license.\n */\n\n// @flow\n${flowBody}`,
    ],
  ])('names Flow when a file with %s fails to parse', (_, code) => {
    expect(() => parseModule(code)).toThrow('Flow syntax is no longer supported');
  });

  it('reports the parse error when @flow only appears after the first statement', () => {
    expect(() => parseModule(`import x from 'x';\n// @flow\n${flowBody}`)).toThrow(
      /^Unexpected token/
    );
  });

  it('names the file in the Flow error', () => {
    expect(() => parseModule(`// @flow\n${flowBody}`, 'Button.stories.js')).toThrow(
      'in Button.stories.js'
    );
  });

  it.each(['/src/api.ts?v=123', '/src/api.mts#hash', '/src/Api.vue', 'api'])(
    'parses a generic arrow in %s',
    (fileName) => {
      const { program } = parseModule('export const id = <T>(value: T) => value;', fileName);
      expect(program.body).toHaveLength(1);
    }
  );

  it('parses JSX in a .tsx id with a query', () => {
    const { program } = parseModule('export const a = <div />;', '/src/A.tsx?import');
    expect(program.body).toHaveLength(1);
  });

  it('accepts a parenthesized comma expression in JSX, but not a bare one', () => {
    const { program } = parseModule("export const a = <B label={(f(), 'x')} />;", 'a.tsx');
    expect(program.body).toHaveLength(1);
    expect(() =>
      parseModule("export const a = <B label={(f(), 'x')} title={g(), 'y'} />;", 'a.tsx')
    ).toThrow('JSX expressions may not use the comma operator (1:46)');
  });

  it('names a file without a TS or JS extension in its parse error', () => {
    expect(() => parseModule('export const = ;', '/src/Api.vue')).toThrow('in /src/Api.vue');
  });

  it('replaces parenthesized nodes by their content, which keeps the outermost span', () => {
    const { program } = parseModule(
      'x = ((a)); type T = ((string));\n@d((b)) export class C {}',
      'a.ts'
    );
    const types = new Set<string>();
    walk(program, (node) => {
      types.add(node.type);
    });
    expect(types.has('ParenthesizedExpression') || types.has('TSParenthesizedType')).toBe(false);

    const [assignment, alias] = program.body as [E.ExpressionStatement, E.TSTypeAliasDeclaration];
    const value = (assignment.expression as E.AssignmentExpression).right;
    expect([value.start, value.end, outerSpan(value)]).toEqual([6, 7, { start: 4, end: 9 }]);
    expect(outerSpan(alias.typeAnnotation)).toEqual({ start: 20, end: 30 });
    expect(outerSpan(assignment)).toMatchObject({ start: 0, end: 10 });
  });

  it.each(['\r\n', '\r'])('parses %j line endings as LF at the same lines and columns', (eol) => {
    const { code } = parseModule(['const a = 1;', 'const b = 2;', ''].join(eol));
    expect(code).toBe('const a = 1;\nconst b = 2;\n');
    expect(() => parseModule(['const a = 1;', 'const b = ;', ''].join(eol))).toThrow(/\(2:10\)$/);
  });

  it('records its parse on a node without adding a key, with its text available', () => {
    const { program } = parseModule('export const a = (1);\n', 'a.ts');
    const [statement] = program.body;
    expect(textOf(statement)).toBe('export const a = (1);');
    expect(Reflect.ownKeys(statement)).toEqual(Object.keys(JSON.parse(JSON.stringify(statement))));
  });

  it('gives nodes and comments whose source text prints', () => {
    const { program, comments } = parseModule("import a from 'a';\nconst b = (a, 1); // end\n");
    expect(textOf(program.body[0])).toBe("import a from 'a';");
    const [declarator] = (program.body[1] as E.VariableDeclaration).declarations;
    expect(placeableTextOf(declarator.init!)).toBe('(a, 1)');
    expect(moduleOf(comments[0])?.program).toBe(program);
  });

  it('normalizes an expression nested deeper than the call stack allows recursion', () => {
    const code = `x = ${Array(20_000).fill('(a)').join(' + ')};`;
    const { program } = parseModule(code);
    expect(program.body).toHaveLength(1);
  });

  it('reports a parse error at its position', () => {
    expect(() => parseModule('const a = 1;\nconst = ;\n', 'a.ts')).toThrow(
      'Unexpected token (2:6) in a.ts'
    );
  });

  it('keeps what it records on a node out of its inspection and equality', () => {
    const [first] = parseModule('a;\nb;', 'a.ts').program.body;
    const [second] = parseModule('a;\nc;', 'a.ts').program.body;
    expect(moduleOf(first)).not.toBe(moduleOf(second));
    expect(first).toEqual(second);
    expect(inspect(first)).toBe(inspect(structuredClone(first)));
    expect(moduleOf({ ...first })).toBeUndefined();
  });
});

describe('parseExpression', () => {
  it.each(['a) + (b', 'a); (b', 'a)(b'])('rejects %s, which is no single expression', (code) => {
    expect(() => parseExpression(code)).toThrow(`Expected an expression: ${code}`);
  });

  it('normalizes a CRLF fragment to LF', () => {
    expect(textOf(parseExpression('{\r\n  a: 1,\r\n}'))).toBe('{\n  a: 1,\n}');
  });
});

describe('codeFrame', () => {
  it('points at the column of the index', () => {
    expect(codeFrame('Button.stories.ts', 'const a = 1;\nconst b = ;', 23)).toBe(
      'Button.stories.ts: (2:10)\n> 2 | const b = ;\n    |           ^'
    );
  });
});

describe('locationOf', () => {
  it('gives 1-based lines and 0-based columns of both offsets', () => {
    expect(locationOf('a;\nconst b = 1;', 3, 8)).toEqual({
      start: { line: 2, column: 0, index: 3 },
      end: { line: 2, column: 5, index: 8 },
    });
  });
});

describe('isIdentifier', () => {
  it('checks the name only when one is given', () => {
    const node = parseExpression('story');
    expect(isIdentifier(node)).toBe(true);
    expect(isIdentifier(node, 'story')).toBe(true);
    expect(isIdentifier(node, 'meta')).toBe(false);
    expect(isIdentifier(parseExpression("'story'"))).toBe(false);
  });
});

describe('objectProperty', () => {
  it('finds the first property with a static key, skipping spreads and dynamic keys', () => {
    const object = parseExpression(
      "{ ...base, [key]: 0, ['args']: 1, args() {}, args: 3 }"
    ) as E.ObjectExpression;
    expect(textOf(objectProperty(object, 'args')!)).toBe("['args']: 1");
    expect(objectProperty(object, 'key')).toBeUndefined();
  });
});
