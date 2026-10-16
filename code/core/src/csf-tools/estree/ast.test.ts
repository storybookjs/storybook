import { describe, expect, it } from 'vitest';

import { codeFrame, parseModule } from './ast.ts';

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
});

describe('codeFrame', () => {
  it('points at the column of the index', () => {
    expect(codeFrame('Button.stories.ts', 'const a = 1;\nconst b = ;', 23)).toBe(
      'Button.stories.ts: (2:10)\n> 2 | const b = ;\n    |           ^'
    );
  });

  it('leaves the carriage return of a CRLF line out of the frame', () => {
    expect(codeFrame(undefined, 'const a = 1;\r\nconst b = ;\r\n', 24)).toBe(
      '(2:10)\n> 2 | const b = ;\n    |           ^'
    );
  });
});
