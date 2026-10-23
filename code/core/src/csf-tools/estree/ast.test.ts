import { inspect } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseSync } from 'oxc-parser';

import {
  type E,
  codeFrame,
  moduleOf,
  parseExpression,
  outerSpan,
  parseModule,
  parsePrintable,
  rawTransferAvailable,
  textOf,
  walk,
  withRawTransfer,
} from './ast.ts';

vi.mock('oxc-parser', { spy: true });

// Where raw transfer is in use, both ways of reading the tree run.
const transfers = rawTransferAvailable ? [true, false] : [false];

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

  it('serializes a printable parse like the parser output, with its text available', () => {
    const code = 'export const a = (1);\n';
    const { program } = parsePrintable(code, 'a.ts');
    expect(textOf(program.body[0])).toBe('export const a = (1);');
    expect(JSON.stringify(program)).toBe(JSON.stringify(parseModule(code, 'a.ts').program));
  });

  it.each(transfers)(
    'normalizes an expression nested deeper than the call stack allows recursion, rawTransfer %s',
    (rawTransfer) => {
      const code = `x = ${Array(20_000).fill('(a)').join(' + ')};`;
      const { program } = withRawTransfer(rawTransfer, () => parseModule(code));
      expect(program.body).toHaveLength(1);
    }
  );

  it.runIf(transfers.length === 2)(
    'reads the same tree through raw transfer as through JSON',
    () => {
      const code = [
        '#!/usr/bin/env node',
        '/** Doc */',
        'export const a = <T,>(x: T) => (x as any)!;',
        'const j = <div a="1">{(1, 2)}</div>;',
        'const r = /a+/gu, b = 10n, n = 0x1f, s = `${b}`;',
        "export default { title: 'A' } satisfies Meta; // end",
      ].join('\n');
      const raw = withRawTransfer(true, () => parseModule(code, 'a.tsx'));
      const json = withRawTransfer(false, () => parseModule(code, 'a.tsx'));
      expect(raw).toEqual(json);
    }
  );

  it.each(transfers)('reports a parse error at its position with rawTransfer %s', (rawTransfer) => {
    expect(() =>
      withRawTransfer(rawTransfer, () => parseModule('const a = 1;\nconst = ;\n', 'a.ts'))
    ).toThrow('Unexpected token (2:6) in a.ts');
  });

  it('keeps what it records on a node out of its inspection and equality', () => {
    const [first] = parsePrintable('a;\nb;', 'a.ts').program.body;
    const [second] = parsePrintable('a;\nc;', 'a.ts').program.body;
    expect(moduleOf(first)).not.toBe(moduleOf(second));
    expect(first).toEqual(second);
    expect(inspect(first)).toBe(inspect(parseModule('a;\nb;', 'a.ts').program.body[0]));
    expect(moduleOf({ ...first })).toBeUndefined();
  });
});

describe('raw transfer fallback', () => {
  afterEach(() => {
    vi.mocked(parseSync).mockReset();
  });

  const failRawTransferWith = async (error: Error) => {
    const actual = await vi.importActual<typeof import('oxc-parser')>('oxc-parser');
    let attempts = 0;
    vi.mocked(parseSync).mockImplementation((name, code, options) => {
      if ((options as { experimentalRawTransfer?: boolean }).experimentalRawTransfer) {
        attempts++;
        throw error;
      }
      return actual.parseSync(name, code, options);
    });
    return () => attempts;
  };

  const parseFive = () => {
    for (let index = 0; index < 5; index++) {
      parseModule(`const a${index} = ${index};`, 'a.ts');
    }
  };

  it('turns raw transfer off for the process when its buffer cannot be allocated', async () => {
    const attempts = await failRawTransferWith(new RangeError('Array buffer allocation failed'));
    expect(() => withRawTransfer(true, parseFive)).toThrow('Raw transfer was turned off');
    expect(attempts()).toBe(1);
  });

  it('keeps raw transfer on when a tree overflows the call stack of its deserializer', async () => {
    const attempts = await failRawTransferWith(new RangeError('Maximum call stack size exceeded'));
    withRawTransfer(true, parseFive);
    expect(attempts()).toBe(5);
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
